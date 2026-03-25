export interface NotificationMessage {
  title: string
  body: string
  icon?: string
  color?: string
  reminderId: number
}

export interface NotificationChannel {
  send(message: NotificationMessage): Promise<void>
}
