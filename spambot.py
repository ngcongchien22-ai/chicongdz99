import asyncio
from telethon import TelegramClient

# Sử dụng API ID & Hash mặc định của app Telegram chính thức
API_ID = 6
API_HASH = "eb06d4abfb49dc3eeb1aeb98ae0f581e"

TARGET_BOT = "@Trumffok_bot"
TOTAL_MESSAGES = 50  # Số lần gửi lệnh /start
DELAY_SECONDS = 1.0  # Khoảng thời gian giữa các lần gửi (giây)


async def main():
  client = TelegramClient("user_session", API_ID, API_HASH)

  print("=== HƯỚNG DẪN ĐĂNG NHẬP ===")
  print("1. Nhập số điện thoại dạng quốc tế (Ví dụ: +84878919288)")
  print("2. Nhập mã OTP gửi về app Telegram trên điện thoại của bạn\n")

  await client.start()

  print(f"\n>>> Đã kết nối thành công! Đang spam /start tới {TARGET_BOT}...\n")

  for i in range(1, TOTAL_MESSAGES + 1):
    try:
      await client.send_message(TARGET_BOT, "/start")
      print(f"[{i}/{TOTAL_MESSAGES}] Đã gửi /start thành công")
    except Exception as e:
      print(f"[{i}/{TOTAL_MESSAGES}] Lỗi: {e}")

    await asyncio.sleep(DELAY_SECONDS)

  print("\n=== HOÀN THÀNH ===")
  await client.disconnect()


if __name__ == "__main__":
  asyncio.run(main())
