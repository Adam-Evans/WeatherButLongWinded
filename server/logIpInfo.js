// Utility to log and debug IPinfo response for troubleshooting
module.exports = function logIpInfo(ipInfo) {
  console.log('IPinfo response:', ipInfo);
  if (!ipInfo || !ipInfo.loc) {
    console.error('IPinfo response missing "loc" property:', ipInfo);
  }
};
