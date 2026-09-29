import { Notification } from 'electron'

/** Fires a native OS notification, if the platform supports it. */
export function notify(title, body) {
  if (!Notification.isSupported()) return
  new Notification({ title, body, urgency: 'critical' }).show()
}
