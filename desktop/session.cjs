/** Limit session bootstrap to the current app main frame, including its exact document URL. */
function isDesktopSender(event, window, origin) {
  return Boolean(window && event.sender === window.webContents
    && event.senderFrame === window.webContents.mainFrame
    && event.senderFrame.url === origin + '/');
}
module.exports = { isDesktopSender };
