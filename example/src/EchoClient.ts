import * as echo_pb from './api/echo_pb';
import {
  GrpcClientImpl,
  GrpcConfig,
  GrpcMetadata,
  GrpcMethodType,
  GrpcCall,
} from '@matejdr/react-native-grpc-client';

export type ServiceError = {
  message: string;
  code: number;
  metadata?: GrpcMetadata;
};
export type Status = { details: string; code: number; metadata: GrpcMetadata };

type dataHandler<T> = (message: T) => void;
type endHandler = (status?: Status) => void;
type statusHandler = (status: Status) => void;

interface UnaryResponse {
  cancel(): void;
}
interface ResponseStream<T> {
  cancel(): void;
  on(type: 'data', handler: dataHandler<T>): ResponseStream<T>;
  on(type: 'end', handler: endHandler): ResponseStream<T>;
  on(type: 'status', handler: statusHandler): ResponseStream<T>;
}

interface RequestStream<T> {
  write(message: T): RequestStream<T>;
  end(): void;
  cancel(): void;
  on(type: 'end', handler: endHandler): RequestStream<T>;
  on(type: 'status', handler: statusHandler): RequestStream<T>;
}
interface BidirectionalStream<ReqT, ResT> {
  write(message: ReqT): BidirectionalStream<ReqT, ResT>;
  end(): void;
  cancel(): void;
  on(type: 'data', handler: dataHandler<ResT>): BidirectionalStream<ReqT, ResT>;
  on(type: 'end', handler: endHandler): BidirectionalStream<ReqT, ResT>;
  on(type: 'status', handler: statusHandler): BidirectionalStream<ReqT, ResT>;
}

export class EchoClient {
  readonly grpcConfig: GrpcConfig;

  constructor(host: string, isInsecure = false) {
    this.grpcConfig = {
      host: host,
      isInsecure: isInsecure,
    };
  }

  unaryEcho(
    requestMessage: echo_pb.EchoRequest,
    metadata: GrpcMetadata,
    callback: (
      error: ServiceError | null,
      responseMessage: echo_pb.EchoResponse | null
    ) => void
  ): UnaryResponse {
    const methodType = 'unary';
    const method = `/echo.Echo/UnaryEcho`;

    let responseHeaders: GrpcMetadata;
    let responseData: echo_pb.EchoResponse;
    const onHeaders = (headers: GrpcMetadata) => {
      responseHeaders = headers;
    };
    const onEnd = (reason?: string) => {
      if (callback) {
        if (reason) {
          callback(
            { message: reason, code: 400, metadata: responseHeaders },
            null
          );
        } else {
          callback(null, responseData);
        }
      }
    };
    const onChunk = (data: Uint8Array) => {
      responseData = echo_pb.EchoResponse.deserializeBinary(data);
    };

    const client = this.startGrpcClient(
      method,
      metadata,
      methodType,
      onHeaders,
      onEnd,
      onChunk
    );

    client
      .sendMessage(requestMessage.serializeBinary())
      .then((response) => {
        console.log('NativeGRPC.sendMessage', response, methodType);
        // finish sending messages for server and unary calls
        if (
          response &&
          ['unary', 'serverStreaming'].indexOf(methodType) !== -1
        ) {
          client.finishSendMessage();
        }
      })
      .catch((error: any) => {
        console.log('NativeGRPC.sendMessage error', error);
      });

    return {
      cancel: () => {
        client.cancel();
      },
    };
  }
  serverStreamingEcho(
    requestMessage: echo_pb.EchoRequest,
    metadata?: GrpcMetadata
  ): ResponseStream<echo_pb.EchoResponse> {
    const methodType = 'serverStreaming';
    const method = `/echo.Echo/ServerStreamingEcho`;
    const listeners: {
      data: dataHandler<echo_pb.EchoResponse>[];
      end: endHandler[];
      status: statusHandler[];
    } = {
      data: [],
      end: [],
      status: [],
    };

    let responseHeaders: GrpcMetadata;
    const onHeaders = (headers: GrpcMetadata) => {
      responseHeaders = headers;
    };
    const onEnd = (reason?: string) => {
      listeners.status.forEach(function (handler) {
        handler({
          code: reason ? 400 : 200,
          details: reason || '',
          metadata: responseHeaders,
        });
      });
      listeners.end.forEach(function (handler) {
        handler({
          code: reason ? 400 : 200,
          details: reason || '',
          metadata: responseHeaders,
        });
      });
      listeners.data = [];
      listeners.end = [];
      listeners.status = [];
    };

    const onChunk = (data: Uint8Array) => {
      listeners.data.forEach((handler) => {
        handler(echo_pb.EchoResponse.deserializeBinary(data));
      });
    };

    const client = this.startGrpcClient(
      method,
      metadata,
      methodType,
      onHeaders,
      onEnd,
      onChunk
    );

    client
      .sendMessage(requestMessage.serializeBinary())
      .then((response) => {
        console.log('NativeGRPC.sendMessage', response, methodType);
        // finish sending messages for server and unary calls
        if (
          response &&
          ['unary', 'serverStreaming'].indexOf(methodType) !== -1
        ) {
          client.finishSendMessage();
        }
      })
      .catch((error: any) => {
        console.log('NativeGRPC.sendMessage error', error);
      });

    return {
      on: function (
        type: 'data' | 'end' | 'status',
        handler: dataHandler<echo_pb.EchoResponse> | endHandler | statusHandler
      ) {
        if (type === 'data') {
          listeners.data.push(handler as dataHandler<echo_pb.EchoResponse>);
        } else if (type === 'end') {
          listeners.end.push(handler as endHandler);
        } else if (type === 'status') {
          listeners.status.push(handler as statusHandler);
        }
        return this;
      },
      cancel: () => {
        listeners.data = [];
        listeners.end = [];
        listeners.status = [];
        client.cancel();
      },
    };
  }
  clientStreamingEcho(
    metadata?: GrpcMetadata
  ): RequestStream<echo_pb.EchoRequest> {
    const methodType = 'clientStreaming';
    const method = `/echo.Echo/ClientStreamingEcho`;
    const listeners: {
      end: endHandler[];
      status: statusHandler[];
    } = {
      end: [],
      status: [],
    };
    let responseHeaders: GrpcMetadata;
    const onHeaders = (headers: GrpcMetadata) => {
      responseHeaders = headers;
    };
    const onEnd = (reason?: string) => {
      listeners.status.forEach(function (handler) {
        handler({
          code: reason ? 400 : 200,
          details: reason || '',
          metadata: responseHeaders,
        });
      });
      listeners.end.forEach(function (handler) {
        handler({
          code: reason ? 400 : 200,
          details: reason || '',
          metadata: responseHeaders,
        });
      });
      listeners.end = [];
      listeners.status = [];
    };

    const client = this.startGrpcClient(
      method,
      metadata,
      methodType,
      onHeaders,
      onEnd,
      undefined
    );

    return {
      on: function (
        type: 'end' | 'status',
        handler: dataHandler<echo_pb.EchoResponse> | endHandler | statusHandler
      ) {
        if (type === 'end') {
          listeners.end.push(handler as endHandler);
        } else if (type === 'status') {
          listeners.status.push(handler as statusHandler);
        }
        return this;
      },
      write: function (requestMessage) {
        client
          .sendMessage(requestMessage.serializeBinary())
          .then((response) => {
            console.log('NativeGRPC.sendMessage', response, methodType);
          })
          .catch((error: any) => {
            console.log('NativeGRPC.sendMessage error', error);
          });
        return this;
      },
      end: () => {
        client.finishSendMessage();
      },
      cancel: () => {
        listeners.end = [];
        listeners.status = [];
        client.cancel();
      },
    };
  }
  bidirectionalStreamingEcho(
    metadata?: GrpcMetadata
  ): BidirectionalStream<echo_pb.EchoRequest, echo_pb.EchoResponse> {
    const methodType = 'serverStreaming';
    const method = `/echo.Echo/ServerStreamingEcho`;
    const listeners: {
      data: dataHandler<echo_pb.EchoResponse>[];
      end: endHandler[];
      status: statusHandler[];
    } = {
      data: [],
      end: [],
      status: [],
    };

    let responseHeaders: GrpcMetadata;
    const onHeaders = (headers: GrpcMetadata) => {
      responseHeaders = headers;
    };
    const onEnd = (reason?: string) => {
      listeners.status.forEach(function (handler) {
        handler({
          code: reason ? 400 : 200,
          details: reason || '',
          metadata: responseHeaders,
        });
      });
      listeners.end.forEach(function (handler) {
        handler({
          code: reason ? 400 : 200,
          details: reason || '',
          metadata: responseHeaders,
        });
      });
      listeners.data = [];
      listeners.end = [];
      listeners.status = [];
    };

    const onChunk = (data: Uint8Array) => {
      listeners.data.forEach((handler) => {
        handler(echo_pb.EchoResponse.deserializeBinary(data));
      });
    };

    const client = this.startGrpcClient(
      method,
      metadata,
      methodType,
      onHeaders,
      onEnd,
      onChunk
    );

    return {
      on: function (
        type: 'data' | 'end' | 'status',
        handler: dataHandler<echo_pb.EchoResponse> | endHandler | statusHandler
      ) {
        if (type === 'data') {
          listeners.data.push(handler as dataHandler<echo_pb.EchoResponse>);
        } else if (type === 'end') {
          listeners.end.push(handler as endHandler);
        } else if (type === 'status') {
          listeners.status.push(handler as statusHandler);
        }
        return this;
      },
      write: function (requestMessage) {
        client
          .sendMessage(requestMessage.serializeBinary())
          .then((response) => {
            console.log('NativeGRPC.sendMessage', response, methodType);
          })
          .catch((error: any) => {
            console.log('NativeGRPC.sendMessage error', error);
          });
        return this;
      },
      end: () => {
        client.finishSendMessage();
      },
      cancel: () => {
        listeners.end = [];
        listeners.status = [];
        client.cancel();
      },
    };
  }

  private startGrpcClient(
    method: string,
    requestHeaders?: GrpcMetadata,
    methodType?: GrpcMethodType,
    onHeaders?: (headers: GrpcMetadata) => void,
    onEnd?: (reason?: string) => void,
    onChunk?: (data: Uint8Array) => void
  ): GrpcCall {
    const call = GrpcClientImpl.startCall(
      this.grpcConfig,
      method,
      requestHeaders,
      methodType
    );
    // const statusOfCall = call.trailers.then<any, any>(
    //   () =>
    //     ({
    //       code: 0,
    //       detail: '',
    //     } as any),
    //   ({ error, code }) => ({
    //     code: code,
    //     detail: error,
    //   })
    // );
    // console.log('statusOfCall', statusOfCall);

    call.headers
      .then((headers) => {
        console.log('NativeGRPC.headers', headers);
        onHeaders && onHeaders(headers);
      })
      .catch((error) => {
        console.log('NativeGRPC.error', error);
        onEnd && onEnd(error);
      });

    call.responses.on('data', (data) => {
      console.log('NativeGRPC.data', data);
      onChunk && onChunk(data);
    });

    call.responses.on('complete', () => {
      console.log('NativeGRPC.complete');
      onEnd && onEnd();
    });

    call.responses.on('error', (reason) => {
      console.log('NativeGRPC.error', reason);
      onEnd && onEnd(reason);
    });

    return call;
  }
}
