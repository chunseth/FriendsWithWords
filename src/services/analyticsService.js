export const trackMultiplayerEvent = async (eventName, payload = {}) => {
  if (!eventName) {
    return;
  }

  console.log("[analytics]", eventName, payload);
};
