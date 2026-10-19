const axios = require('axios');

// Token bot Telegram của bạn
const BOT_TOKEN = '8685902649:AAHbvHNo2OBj7H0RRERVEkioWtDrPvhguO0';

export default async function handler(req, res) {
    // Chỉ cho phép phương thức POST từ Mini App gọi lên
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        // Lấy chat_id của người dùng từ Mini App gửi lên
        const chatId = req.body.chat_id;

        if (!chatId) {
            return res.status(400).json({ success: false, message: 'Thiếu chat_id!' });
        }

        // Gọi Telegram Bot API để tự động nhắn tin / gửi file vào chat cho user
        const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        
        await axios.post(telegramUrl, {
            chat_id: chatId,
            text: "✨ Yêu cầu tạo file của bạn đã được tiếp nhận thành công từ Mini App!"
        });

        return res.status(200).json({ success: true, message: 'Đã gửi thành công!' });

    } catch (error) {
        console.error('Lỗi:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
    }
}
