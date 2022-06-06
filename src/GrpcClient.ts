import { AbortController, AbortSignal } from 'abort-controller';
import { fromByteArray, toByteArray } from 'base64-js';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { GrpcError } from './GrpcError';
import type { GrpcConfig, GrpcMetadata, GrpcMethodType } from './types';
import { GrpcCall, ServerOutputStream } from './GrpcCall';

type GrpcRequestObject = {
  data: string;
};

type GrpcType = {
  startCall(
    id: number,
    config: GrpcConfig,
    path: string,
    requestHeaders?: GrpcMetadata,
    methodType?: GrpcMethodType
  ): Promise<number>;
  sendMessage(id: number, obj: GrpcRequestObject): Promise<boolean>;
  cancelGrpcCall: (id: number) => Promise<boolean>;
  finishClientStreaming(id: number): Promise<void>;
};

type GrpcEventType = 'response' | 'error' | 'headers' | 'trailers';

/* prettier-ignore */
type GrpcEventPayload =
  {
    type: 'response';
    payload: string;
  } | {
    type: 'error';
    error: string;
    code?: number;
  } | {
    type: 'headers';
    payload: GrpcMetadata;
  } | {
    type: 'trailers';
    payload: GrpcMetadata;
  } | {
    type: 'status';
    payload: number;
  };

type GrpcEvent = {
  id: number;
  type: GrpcEventType;
} & GrpcEventPayload;

const LINKING_ERROR =
  `The package '@matejdr/react-native-grpc-client' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo managed workflow\n';

const GrpcBridge: GrpcType = NativeModules.GrpcBridge
  ? NativeModules.GrpcBridge
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

const Emitter = new NativeEventEmitter(NativeModules.GrpcBridge);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
};

type DeferredCalls = {
  headers?: Deferred<GrpcMetadata>;
  response?: Deferred<Uint8Array>;
  trailers?: Deferred<GrpcMetadata>;
  data?: ServerOutputStream;
};

type DeferredCallMap = {
  [id: number]: DeferredCalls;
};

function createDeferred<T>(signal: AbortSignal) {
  let completed = false;

  const deferred: Deferred<T> = {} as any;

  deferred.promise = new Promise<T>((resolve, reject) => {
    deferred.resolve = (value) => {
      completed = true;

      resolve(value);
    };
    deferred.reject = (reason) => {
      completed = true;

      reject(reason);
    };
  });

  signal.addEventListener('abort', () => {
    if (!completed) {
      deferred.reject('aborted');
    }
  });

  return deferred;
}

let idCtr = 1;

const deferredMap: DeferredCallMap = {};

function handleGrpcEvent(event: GrpcEvent) {
  const deferred = deferredMap[event.id];
  if (deferred) {
    switch (event.type) {
      case 'headers':
        deferred.headers?.resolve(event.payload);
        break;
      case 'response':
        const data = toByteArray(event.payload);

        deferred.data?.notifyData(data);
        deferred.response?.resolve(data);
        break;
      case 'trailers':
        deferred.trailers?.resolve(event.payload);
        deferred.data?.notifyComplete();

        delete deferredMap[event.id];
        break;
      case 'error':
        const error = new GrpcError(event.error, event.code);

        deferred.headers?.reject(error);
        deferred.trailers?.reject(error);
        deferred.response?.reject(error);
        deferred.data?.noitfyError(error);

        delete deferredMap[event.id];
        break;
    }
  }
}

function getId(): number {
  return idCtr++;
}

export class GrpcClient {
  constructor() {
    Emitter.addListener('grpc-call', handleGrpcEvent);
  }
  destroy() {
    Emitter.removeAllListeners('grpc-call');
  }
  startCall(
    config: GrpcConfig,
    method: string,
    requestHeaders?: GrpcMetadata,
    methodType?: GrpcMethodType
  ): GrpcCall {
    const id = getId();
    const abort = new AbortController();

    abort.signal.addEventListener('abort', () => {
      GrpcBridge.cancelGrpcCall(id);
    });

    const headers = createDeferred<GrpcMetadata>(abort.signal);
    const trailers = createDeferred<GrpcMetadata>(abort.signal);

    const stream = new ServerOutputStream();

    deferredMap[id] = {
      headers,
      trailers,
      data: stream,
    };

    GrpcBridge.startCall(id, config, method, requestHeaders || {}, methodType);

    const call = new GrpcCall(
      method,
      requestHeaders || {},
      headers.promise,
      stream,
      trailers.promise,
      abort,
      (data: Uint8Array) => {
        const requestData = fromByteArray(data);
        const obj: GrpcRequestObject = {
          data: requestData,
        };
        return GrpcBridge.sendMessage(id, obj);
      },
      () => {
        return GrpcBridge.finishClientStreaming(id);
      }
    );

    call.then(
      (result) => result,
      () => abort.abort()
    );

    return call;
  }
}

export const GrpcClientImpl = new GrpcClient();

export { GrpcBridge };
