#import "AppDelegate.h"

#import <Firebase.h>
#import <React/RCTBundleURLProvider.h>
#if DEBUG
#import <React/RCTDevLoadingViewSetEnabled.h>
#endif

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Configure Firebase first so it's available before any native module or JS runs
  [FIRApp configure];

#if DEBUG
  // Disable the native dev loading banner so startup doesn't flash a mismatched light progress strip.
  RCTDevLoadingViewSetEnabled(NO);
#endif

  self.moduleName = @"FriendsWithWords";
  self.initialProps = @{};

  BOOL didFinishLaunching = [super application:application didFinishLaunchingWithOptions:launchOptions];
  if (@available(iOS 13.0, *)) {
    self.window.overrideUserInterfaceStyle = UIUserInterfaceStyleDark;
    self.window.rootViewController.overrideUserInterfaceStyle = UIUserInterfaceStyleDark;
  }

  return didFinishLaunching;
}

- (UIView *)createRootViewWithBridge:(RCTBridge *)bridge
                          moduleName:(NSString *)moduleName
                           initProps:(NSDictionary *)initProps
{
  UIView *rootView = [super createRootViewWithBridge:bridge moduleName:moduleName initProps:initProps];
  rootView.backgroundColor = [UIColor colorWithRed:11.0 / 255.0
                                             green:18.0 / 255.0
                                              blue:32.0 / 255.0
                                             alpha:1.0];
  return rootView;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
