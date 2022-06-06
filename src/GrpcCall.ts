import type { AbortController } from 'abort-controller';
import { EventEmitter } from 'eventemitter3';
import type {
  CompletedGrpcCall,
  GrpcMetadata,
  GrpcServerOutputStream,
  ServerOutputEvent,
  ServerOutputEventCallback,
} from './types';

export class GrpcCall implements PromiseLike<CompletedGrpcCall> {
  readonly method: string;
  readonly requestHeaders: GrpcMetadata;
  readonly headers: Promise<GrpcMetadata>;
  readonly responses: GrpcServerOutputStream;
  readonly trailers: Promise<GrpcMetadata>;
  readonly onSendMessage: (data: Uint8Array) => Promise<boolean>;
  readonly onFinishSendMessage: () => Promise<void>;

  #abort: AbortController;

  private isFinished = false;

  constructor(
    method: string,
    requestHeaders: GrpcMetadata,
    headers: Promise<GrpcMetadata>,
    responses: ServerOutputStream,
    trailers: Promise<GrpcMetadata>,
    abort: AbortController,
    onSendMessage: (data: Uint8Array) => Promise<boolean>,
    onFinishSendMessage: () => Promise<void>
  ) {
    this.method = method;
    this.requestHeaders = requestHeaders;
    this.headers = headers;
    this.responses = responses;
    this.trailers = trailers;
    this.#abort = abort;
    this.onSendMessage = onSendMessage;
    this.onFinishSendMessage = onFinishSendMessage;
  }

  then<TResult1 = CompletedGrpcCall, TResult2 = unknown>(
    onfulfilled?:
      | ((value: CompletedGrpcCall) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.completedPromise().then(
      (value) =>
        onfulfilled
          ? Promise.resolve(onfulfilled(value))
          : (value as unknown as TResult1),
      (reason) =>
        onrejected
          ? Promise.resolve(onrejected(reason))
          : Promise.reject(reason)
    );
  }

  sendMessage(data: Uint8Array): Promise<boolean> {
    return this.onSendMessage(data);
  }

  finishSendMessage(): Promise<void> | void {
    if (!this.isFinished) {
      this.isFinished = true;
      return this.onFinishSendMessage();
    }
  }

  cancel() {
    this.#abort.abort();
  }

  private async completedPromise(): Promise<CompletedGrpcCall> {
    const [headers, trailers] = await Promise.all([
      this.headers,
      this.trailers,
    ]);

    return {
      method: this.method,
      requestHeaders: this.requestHeaders,
      headers,
      trailers,
      status: 0,
    };
  }
}

export class ServerOutputStream implements GrpcServerOutputStream {
  #emitter = new EventEmitter<ServerOutputEvent>();

  on<T extends ServerOutputEvent>(
    event: T,
    callback: ServerOutputEventCallback<T>
  ) {
    this.#emitter.addListener(event, callback);

    return () => {
      this.#emitter.removeListener(event, callback);
    };
  }

  notifyData(data: Uint8Array): void {
    this.#emitter.emit('data', data);
  }

  notifyComplete(): void {
    this.#emitter.emit('complete');
  }

  noitfyError(reason: any): void {
    this.#emitter.emit('error', reason);
  }
}
