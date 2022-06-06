# react-native-grpc-client

gRPC client for React Native. A bridge to use the native gRPC in React Native apps.

## Installation

```sh
npm install @matejdr/react-native-grpc-client
```

### Node version

```sh
nvm install
```
or
```sh
nvm use
```

### Install npm packages

```sh
yarn install
```

## Usage

```js
import { GrpcClientImpl, GrpcConfig, GrpcMetadata, GrpcMethodType } from '@matejdr/react-native-grpc-client';

const grpcConfig: GrpcConfig = {
  host: '<your gRPC host>',
  isInsecure: true,
};
const grpcMethod = `/<your gRPC service name>/<your gRPC method name>`;
const headers: GrpcMetadata = {};
const methodType = 'bidiStreaming';

const call = GrpcClientImpl.startCall(
  grpcConfig,
  grpcMethod,
  headers,
  methodType
);

call.headers
  .then((headers) => {
    console.log('NativeGRPC.headers', headers);
  })
  .catch((error) => {
    console.log('NativeGRPC.headers.error', error);
  });

call.responses.on('data', (data) => {
  console.log('NativeGRPC.data', data);
});

call.responses.on('complete', () => {
  console.log('NativeGRPC.complete');
});

call.responses.on('error', (reason) => {
  console.log('NativeGRPC.error', reason);
});

// send your message
const msgBytes: Uint8Array = []

call
  .sendMessage(msgBytes)
  .then((response) => {
    console.log('NativeGRPC.sendMessage', response, methodType);
    // finish sending messages for server and unary calls
    if (
      response &&
      ['unary', 'serverStreaming'].indexOf(methodType) !== -1
    ) {
      call.finishSendMessage();
    }
  })
  .catch((error) => {
    console.log('NativeGRPC.sendMessage error', error);
  });

// cancel ccall after 10 seconds - for demo purposes
setTimeout(() => {
  call.cancel();
}, 10000)
```

## Running a docker Server for example app

There is an envoy proxy in front of go server.

```sh
cd server
docker-compose up --build server envoy
```

## Running a gRPC Server manually

You can also run the grpc server manually using the following instructions.

### Install protoc

* protoc : [link](https://github.com/protocolbuffers/protobuf/releases)

### Install for go

```sh
go get -u google.golang.org/grpc
go get -u github.com/golang/protobuf/proto
go install github.com/golang/protobuf/protoc-gen-go@latest
export PATH=$HOME/go/bin:$PATH
````

### Generate stubs for js and go

```sh
protoc \
  --proto_path=server/proto \
  --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
  --js_out=import_style=commonjs:example/src/api \
  --ts_out=example/src/api \
  echo.proto
protoc \
  --proto_path=server/proto \
  --go_out=plugins=grpc:server/echoserver/echo \
  --go_opt=paths=source_relative \
  echo.proto
```

### Running a server

```sh
cd server/echoserver
go run main.go
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT
