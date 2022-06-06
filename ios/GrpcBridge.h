#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface GrpcBridge : RCTEventEmitter <RCTBridgeModule>

// TODO: remove
// @property (nonatomic, copy) NSString* grpcHost;
// @property (nonatomic, assign) BOOL grpcInsecure;

@end
