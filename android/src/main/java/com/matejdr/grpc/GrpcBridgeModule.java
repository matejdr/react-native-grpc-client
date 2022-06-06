package com.matejdr.grpc;

import android.util.Base64;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashMap;
import java.util.Map;

import io.grpc.CallOptions;
import io.grpc.ClientCall;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Metadata;
import io.grpc.MethodDescriptor;
import io.grpc.Status;

@ReactModule(name = GrpcBridgeModule.NAME)
public class GrpcBridgeModule extends ReactContextBaseJavaModule {
  public static final String NAME = "GrpcBridge";

  private final ReactApplicationContext context;
  private final HashMap<Integer, ClientCall> callsMap = new HashMap<>();

  public GrpcBridgeModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.context = reactContext;
  }

  private static String normalizePath(String path) {
    if (path.startsWith("/")) {
      path = path.substring(1);
    }

    return path;
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void startCall(int id, ReadableMap config, String path, ReadableMap headers, String methodType, final Promise promise) {
    String grpcHost = config.getString("host");
    boolean grpcIsInsecure = config.hasKey("isInsecure") && config.getBoolean("isInsecure");
    MethodDescriptor.MethodType grpcMethodType;
    if (methodType == null) {
      methodType = "bidiStreaming";
    }
    switch (methodType) {
      case "unary":
        grpcMethodType = MethodDescriptor.MethodType.UNARY;
        break;
      case "serverStreaming":
        grpcMethodType = MethodDescriptor.MethodType.SERVER_STREAMING;
        break;
      case "clientStreaming":
        grpcMethodType = MethodDescriptor.MethodType.CLIENT_STREAMING;
        break;
      case "bidiStreaming":
      default:
        grpcMethodType = MethodDescriptor.MethodType.BIDI_STREAMING;
        break;
    }
    ClientCall call = this.startGrpcCall(id, path, grpcMethodType, headers, grpcHost, grpcIsInsecure);

    callsMap.put(id, call);

    promise.resolve(id);
  }

  @ReactMethod
  public void sendMessage(int id, ReadableMap obj, final Promise promise) {
    if (callsMap.containsKey(id)) {
      ClientCall call = callsMap.get(id);

      byte[] data = Base64.decode(obj.getString("data"), Base64.NO_WRAP);

      call.sendMessage(data);
      call.request(1);
//      call.halfClose();

      promise.resolve(true);
    } else {
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void finishClientStreaming(int id, final Promise promise) {
    if (callsMap.containsKey(id)) {
      ClientCall call = callsMap.get(id);

      call.halfClose();

      promise.resolve(true);
    } else {
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void cancelGrpcCall(int id, final Promise promise) {
    if (callsMap.containsKey(id)) {
      ClientCall call = callsMap.get(id);
      call.cancel("Cancelled", new Exception("Cancelled by app"));

      promise.resolve(true);
    } else {
      promise.resolve(false);
    }
  }

  private ClientCall startGrpcCall(int id, String path, MethodDescriptor.MethodType methodType, ReadableMap headers, String grpcHost, boolean grpcIsInsecure) {
    path = normalizePath(path);

    final Metadata headersMetadata = new Metadata();

    for (Map.Entry<String, Object> headerEntry : headers.toHashMap().entrySet()) {
      headersMetadata.put(Metadata.Key.of(headerEntry.getKey(), Metadata.ASCII_STRING_MARSHALLER), headerEntry.getValue().toString());
    }

    ManagedChannelBuilder channelBuilder = ManagedChannelBuilder.forTarget(grpcHost);

    if (grpcIsInsecure) {
      channelBuilder = channelBuilder.usePlaintext();
    }

    ManagedChannel channel = channelBuilder.build();

    MethodDescriptor.Marshaller<byte[]> marshaller = new GrpcMarshaller();

    MethodDescriptor descriptor = MethodDescriptor.<byte[], byte[]>newBuilder()
      .setFullMethodName(path)
      .setType(methodType)
      .setRequestMarshaller(marshaller)
      .setResponseMarshaller(marshaller)
      .build();

    CallOptions callOptions = CallOptions.DEFAULT;

    ClientCall call = channel.newCall(descriptor, callOptions);

    call.start(new ClientCall.Listener() {
      @Override
      public void onHeaders(Metadata headers) {
        super.onHeaders(headers);

        WritableMap event = Arguments.createMap();
        WritableMap payload = Arguments.createMap();

        for (String key : headers.keys()) {
          payload.putString(key, headers.get(Metadata.Key.of(key, Metadata.ASCII_STRING_MARSHALLER)));
        }

        event.putInt("id", id);
        event.putString("type", "headers");
        event.putMap("payload", payload);

        emitEvent("grpc-call", event);
      }

      @Override
      public void onMessage(Object messageObj) {
        super.onMessage(messageObj);

        byte[] data = (byte[]) messageObj;

        WritableMap event = Arguments.createMap();

        event.putInt("id", id);
        event.putString("type", "response");
        event.putString("payload", Base64.encodeToString(data, Base64.NO_WRAP));

        emitEvent("grpc-call", event);

        if (methodType == MethodDescriptor.MethodType.SERVER_STREAMING) {
          call.request(1);
        }
      }

      @Override
      public void onClose(Status status, Metadata trailers) {
        super.onClose(status, trailers);

        callsMap.remove(id);

        WritableMap event = Arguments.createMap();
        event.putInt("id", id);

        if (!status.isOk()) {
          event.putString("type", "error");
          event.putString("error", status.asException(trailers).getLocalizedMessage());
          event.putInt("code", status.getCode().value());
        } else {
          event.putString("type", "trailers");

          WritableMap payload = Arguments.createMap();

          for (String key : trailers.keys()) {
            payload.putString(key, trailers.get(Metadata.Key.of(key, Metadata.ASCII_STRING_MARSHALLER)));
          }

          event.putMap("payload", payload);
        }

        emitEvent("grpc-call", event);
      }
    }, headersMetadata);

    return call;
  }

  private void emitEvent(String eventName, Object params) {
    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventName, params);
  }
}
