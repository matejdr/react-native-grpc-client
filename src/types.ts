export type GrpcMetadata = Record<string, string>;

export type GrpcConfig = {
  host: string;
  isInsecure: boolean;
};

export type RemoveListener = () => void;

export type DataCallback = (data: Uint8Array) => void;
export type ErrorCallback = (reason: any) => void;
export type CompleteCallback = () => void;

export type ServerOutputEvent = 'data' | 'error' | 'complete';
export type ServerOutputEventCallback<T> = T extends 'data'
  ? DataCallback
  : T extends 'complete'
  ? CompleteCallback
  : T extends 'error'
  ? ErrorCallback
  : never;

export interface GrpcServerOutputStream {
  on<T extends ServerOutputEvent>(
    event: T,
    callback: ServerOutputEventCallback<T>
  ): RemoveListener;
}

export type CompletedGrpcCall = {
  readonly method: string;
  readonly requestHeaders: GrpcMetadata;
  readonly headers?: GrpcMetadata;
  readonly responses?: GrpcServerOutputStream;
  readonly status?: number;
  readonly trailers?: GrpcMetadata;
  readonly onSendMessage?: (data: Uint8Array) => Promise<boolean>;
  readonly onFinishSendMessage?: () => Promise<void>;
};
export type GrpcMethodType =
  | 'unary'
  | 'serverStreaming'
  | 'clientStreaming'
  | 'bidiStreaming';
