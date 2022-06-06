import React, { useState } from 'react';

import { Button, Text, View } from 'react-native';

import { EchoClient, ServiceError } from './EchoClient';
import { EchoRequest, EchoResponse } from './api/echo_pb';

export default () => {
  const [response, setResponse] = useState<string[]>([]);

  const setIntervalX = (
    callback: (x: number) => void,
    closeCallback: (x: number) => void,
    delay: number,
    repetitions: number
  ): void => {
    let x = 0;
    const intervalID = setInterval(function () {
      callback(x);

      if (++x === repetitions) {
        clearInterval(intervalID);
        closeCallback(x);
      }
    }, delay);
  };

  async function sendUnaryEcho() {
    try {
      setResponse([]);

      const url = '192.168.0.166:9010';
      const service = new EchoClient(url, true);

      const request = new EchoRequest();
      request.setMessage('This is my Unary message.');
      const metadata = {
        // 'custom-header-1': 'value1',
      } as any;
      service.unaryEcho(
        request,
        metadata,
        (err: ServiceError | null, res: EchoResponse | null) => {
          console.log('response', err, res);
          setResponse((arr) => [
            ...arr,
            (res && res.getMessage()) || (err && err.message) || '',
          ]);
        }
      );
    } catch (e) {
      console.error('error', e);
    }
  }

  async function sendServerStreamingEcho() {
    try {
      setResponse([]);

      const url = '192.168.0.166:9010';
      console.log('url', url);
      const service = new EchoClient(url, true);

      const request = new EchoRequest();
      request.setMessage('This is my ServerStreaming message.');
      const metadata = {
        // 'custom-header-1': 'value1',
      } as any;
      const serverStream = service.serverStreamingEcho(request, metadata);
      serverStream.on('data', (message) => {
        console.log('message', message);
        console.log('message1', message.getMessage());
        setResponse((arr) => [...arr, message && message.getMessage()]);
      });
      serverStream.on('end', (status) => {
        console.log('on end', status);
        setResponse((arr) => [
          ...arr,
          `on end: ${status && JSON.stringify(status)}`,
        ]);
      });
      serverStream.on('status', (status) => {
        console.log('on status', status);
        setResponse((arr) => [
          ...arr,
          `on end: ${status && JSON.stringify(status)}`,
        ]);
      });
    } catch (e) {
      console.error('error', e);
    }
  }

  async function sendBidirectionalStreamingEcho() {
    console.log('running again');
    try {
      setResponse([]);

      const url = '192.168.0.166:9010';
      console.log('url', url);
      const service = new EchoClient(url, true);

      const metadata = {
        // 'custom-header-1': 'value1',
      } as any;
      const bidirectionalStream = service.bidirectionalStreamingEcho(metadata);
      bidirectionalStream.on('data', (message) => {
        console.log('message', message);
        console.log('message1', message.getMessage());
        setResponse((arr) => [...arr, message && message.getMessage()]);
      });
      bidirectionalStream.on('end', (status) => {
        console.log('on end', status);
        setResponse((arr) => [
          ...arr,
          `on end: ${status && JSON.stringify(status)}`,
        ]);
      });
      bidirectionalStream.on('status', (status) => {
        console.log('on status', status);
        setResponse((arr) => [
          ...arr,
          `on end: ${status && JSON.stringify(status)}`,
        ]);
      });

      const request = new EchoRequest();
      request.setMessage('This is BidirectionalStreaming message number: 1.');
      bidirectionalStream.write(request);
      // bidirectionalStream.end();
      request.setMessage('This is BidirectionalStreaming message number: 2.');
      bidirectionalStream.write(request);
      // bidirectionalStream.end();
      request.setMessage('This is BidirectionalStreaming message number: 3.');
      bidirectionalStream.write(request);
      // bidirectionalStream.end();
      setIntervalX(
        (x) => {
          console.log('sending message: ', x);
          const request = new EchoRequest();
          request.setMessage(`This is message number: ${x}.`);
          bidirectionalStream.write(request);
        },
        (x) => {
          console.log('closing connection after repeats: ', x);
          bidirectionalStream.end();
        },
        5000,
        2
      );
    } catch (e) {
      console.error('error', e);
    }
  }

  async function sendClientStreamingEcho() {
    console.log('running again');
    try {
      setResponse([]);

      const url = '192.168.0.166:9010';
      console.log('url', url);
      const service = new EchoClient(url, true);

      const metadata = {
        // 'custom-header-1': 'value1',
      } as any;
      const clientStreamingEcho = service.clientStreamingEcho(metadata);
      clientStreamingEcho.on('end', (status) => {
        console.log('on end', status);
        setResponse((arr) => [
          ...arr,
          `on end: ${status && JSON.stringify(status)}`,
        ]);
      });
      clientStreamingEcho.on('status', (status) => {
        console.log('on status', status);
        setResponse((arr) => [
          ...arr,
          `on end: ${status && JSON.stringify(status)}`,
        ]);
      });

      const request = new EchoRequest();
      request.setMessage('This is BidirectionalStreaming message number: 1.');
      clientStreamingEcho.write(request);
      // clientStreamingEcho.end();
      setIntervalX(
        (x) => {
          console.log('sending message: ', x);
          const request = new EchoRequest();
          request.setMessage(`This is message number: ${x}.`);
          clientStreamingEcho.write(request);
        },
        (x) => {
          console.log('closing connection after repeats: ', x);
          clientStreamingEcho.end();
        },
        5000,
        2
      );
    } catch (e) {
      console.error('error', e);
    }
  }

  return (
    <View>
      <Text style={{ textAlign: 'center', marginTop: 20 }}>
        Send Echo to gRPC
      </Text>
      <Button
        onPress={() => sendUnaryEcho()}
        title="Send unaryEcho!"
        color="#841584"
        accessibilityLabel="Lets hit that grpc server"
      />
      <Button
        onPress={() => sendServerStreamingEcho()}
        title="Send serverStreamingEcho!"
        color="#841584"
        accessibilityLabel="Lets hit that grpc server"
      />
      <Button
        onPress={() => sendBidirectionalStreamingEcho()}
        title="Send bidirectionalStreamingEcho!"
        color="#841584"
        accessibilityLabel="Lets hit that grpc server"
      />
      <Button
        onPress={() => sendClientStreamingEcho()}
        title="Send clientStreamingEcho!"
        color="#841584"
        accessibilityLabel="Lets hit that grpc server"
      />
      <View style={{ justifyContent: 'center' }}>
        {response.map((r, i) => (
          <View key={i}>
            <Text style={{ textAlign: 'center', paddingBottom: 5 }}>{r}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};
