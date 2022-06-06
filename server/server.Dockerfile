FROM golang:1.16

RUN apt-get update && apt-get install -y unzip

# Install protobuf
RUN mkdir -p /usr/bin/protoc \
  # now fetch a zip from https://github.com/google/protobuf/releases and unpack it into proto/
  && GOPROTO=protoc-3.5.1-linux-x86_64.zip \
  && wget https://github.com/google/protobuf/releases/download/v3.5.1/$GOPROTO \
  && unzip ./$GOPROTO -d /usr/bin/protoc \
  && rm $GOPROTO

# Install go packages (Should this use go-wrapper according to docker hub instructions?)
RUN go get -u google.golang.org/grpc \
  && go get -u github.com/golang/protobuf/proto \
  && go install github.com/golang/protobuf/protoc-gen-go@latest

# Copy the code
WORKDIR /go/src/github.com/matejdr/react-native-grpc-web-demo/echoserver/echo
COPY ./proto ./proto
COPY ./echoserver ./echoserver

# Generate grpc server impl from protobuf
RUN /usr/bin/protoc/bin/protoc --proto_path=proto --go_out=plugins=grpc:echoserver/echo --go_opt=paths=source_relative echo.proto

RUN cd ./echoserver && go mod tidy

WORKDIR /go/src/github.com/matejdr/react-native-grpc-web-demo/echoserver/echo/echoserver

# Run the server (Again, should it use go-wrapper run?)
ENV PORT=9010
EXPOSE $PORT

CMD ["go", "run", "./main.go"]
