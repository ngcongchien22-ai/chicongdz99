document.addEventListener('DOMContentLoaded', () => {
    // Đã đổi thành '#go' khớp với id của nút "Tạo file" trong index.html của mày
    const taoFileBtn = document.querySelector('#go'); 

    if (taoFileBtn) {
        taoFileBtn.addEventListener('click', async () => {
            const chatId = Telegram.WebApp.initDataUnsafe.user?.id;

            if (!chatId) {
                alert("Không lấy được thông tin tài khoản Telegram!");
                return;
            }

            try {
                Telegram.WebApp.MainButton.text = "Đang tạo file...";
                Telegram.WebApp.MainButton.show();

                // Gọi sang file API trên Vercel
                let response = await fetch('https://chicongdz99.vercel.app/api/tao-file', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ chat_id: chatId })
                });

                let result = await response.json();

                if (result.success) {
                    // Tự động đóng Mini App để bot gửi tin nhắn vào chat
                    Telegram.WebApp.close();
                } else {
                    alert("Lỗi: " + result.message);
                }
            } catch (err) {
                console.error(err);
                alert("Không thể kết nối tới server!");
            } finally {
                Telegram.WebApp.MainButton.hide();
            }
        });
    }
});
