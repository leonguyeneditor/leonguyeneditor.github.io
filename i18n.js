// Reset Journal: đa ngôn ngữ (10/11).
// Cách hoạt động: code giao diện vẫn viết tiếng Anh. File này đổi chữ tiếng Anh trên màn hình
// sang ngôn ngữ đã chọn theo từ điển bên dưới. Câu nào chưa có trong từ điển thì giữ tiếng Anh.
// Thuật ngữ trading (FVG, MSS, PDH, R, P&L…) cố ý giữ nguyên.
// Chọn ngôn ngữ ở Settings → Language (lưu trong trình duyệt: localStorage "rj-lang").
(function () {
  const LANGS = { en: 'English', vi: 'Tiếng Việt', es: 'Español', pt: 'Português (Brasil)', id: 'Bahasa Indonesia' };
  const LOCALES = { en: 'en-US', vi: 'vi-VN', es: 'es-ES', pt: 'pt-BR', id: 'id-ID' };
  let lang = 'en';
  try { lang = localStorage.getItem('rj-lang') || 'en'; } catch { /* bỏ qua */ }
  if (!LANGS[lang]) lang = 'en';
  const locale = LOCALES[lang];
  // Tên tháng ngắn; tiếng Việt dùng Th1…Th12 cho gọn ("Tháng 11" quá dài trên lịch)
  const months = lang === 'vi' ? Array.from({ length: 12 }, (_, i) => `Th${i + 1}`)
    : Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, i, 15)).toLocaleString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', ''));

  // ---------- Từ điển: [English, Tiếng Việt, Español, Português, Bahasa Indonesia] ----------
  const ROWS = [
    // Khung chung, menu
    ['Trading Journal', 'Nhật ký giao dịch', 'Diario de trading', 'Diário de trading', 'Jurnal trading'],
    ['+ New trade', '+ Lệnh mới', '+ Nueva operación', '+ Nova operação', '+ Transaksi baru'],
    ['New trade', 'Lệnh mới', 'Nueva operación', 'Nova operação', 'Transaksi baru'],
    ['Dashboard', 'Tổng quan', 'Panel', 'Painel', 'Dasbor'],
    ['Daily Journal', 'Nhật ký ngày', 'Diario diario', 'Diário do dia', 'Jurnal harian'],
    ['Daily', 'Theo ngày', 'Diario', 'Diário', 'Harian'],
    ['Trades', 'Lệnh', 'Operaciones', 'Operações', 'Transaksi'],
    ['Models', 'Mô hình', 'Modelos', 'Modelos', 'Model'],
    ['Accounts', 'Tài khoản', 'Cuentas', 'Contas', 'Akun'],
    ['Notebook', 'Sổ ghi chú', 'Cuaderno', 'Caderno', 'Buku catatan'],
    ['Settings', 'Cài đặt', 'Ajustes', 'Configurações', 'Pengaturan'],
    ['Overview', 'Trang chủ', 'Inicio', 'Início', 'Beranda'],
    ['RESET YOUR MIND.', 'LÀM MỚI TƯ DUY.', 'REINICIA TU MENTE.', 'REINICIE SUA MENTE.', 'SEGARKAN PIKIRANMU.'],
    ['REBUILD YOUR SYSTEM.', 'XÂY LẠI HỆ THỐNG.', 'RECONSTRUYE TU SISTEMA.', 'RECONSTRUA SEU SISTEMA.', 'BANGUN ULANG SISTEMMU.'],
    ['All accounts', 'Tất cả tài khoản', 'Todas las cuentas', 'Todas as contas', 'Semua akun'],
    ['Live (real money)', 'Live (tiền thật)', 'Real (dinero real)', 'Real (dinheiro real)', 'Live (uang asli)'],
    ['Demo (practice)', 'Demo (luyện tập)', 'Demo (práctica)', 'Demo (prática)', 'Demo (latihan)'],
    ['Manage accounts…', 'Quản lý tài khoản…', 'Gestionar cuentas…', 'Gerenciar contas…', 'Kelola akun…'],
    ['Search trades…', 'Tìm lệnh…', 'Buscar operaciones…', 'Buscar operações…', 'Cari transaksi…'],
    ['Collapse menu', 'Thu gọn menu', 'Contraer menú', 'Recolher menu', 'Ciutkan menu'],
    ['Switch light or dark mode', 'Đổi sáng / tối', 'Cambiar modo claro u oscuro', 'Alternar modo claro ou escuro', 'Ganti mode terang atau gelap'],
    ['STOP.', 'DỪNG LẠI.', 'PARA.', 'PARE.', 'BERHENTI.'],
    ['Last trade:', 'Lệnh gần nhất:', 'Última operación:', 'Última operação:', 'Transaksi terakhir:'],
    // Dashboard
    ['Week', 'Tuần', 'Semana', 'Semana', 'Minggu'],
    ['Month', 'Tháng', 'Mes', 'Mês', 'Bulan'],
    ['All', 'Tất cả', 'Todo', 'Tudo', 'Semua'],
    ['All time', 'Toàn bộ', 'Todo el tiempo', 'Todo o período', 'Sepanjang waktu'],
    ['This week', 'Tuần này', 'Esta semana', 'Esta semana', 'Minggu ini'],
    ['Today', 'Hôm nay', 'Hoy', 'Hoje', 'Hari ini'],
    ['Trade win %', 'Tỷ lệ thắng lệnh', '% de operaciones ganadoras', '% de operações vencedoras', '% transaksi menang'],
    ['Profit factor', 'Profit factor', 'Factor de beneficio', 'Fator de lucro', 'Profit factor'],
    ['Day win %', 'Tỷ lệ ngày thắng', '% de días ganadores', '% de dias vencedores', '% hari menang'],
    ['Avg win/loss trade', 'Lãi TB / lỗ TB', 'Ganancia/pérdida media', 'Ganho/perda médio', 'Rata-rata untung/rugi'],
    ['Avg win/loss', 'Lãi TB / lỗ TB', 'Ganancia/pérdida media', 'Ganho/perda médio', 'Rata-rata untung/rugi'],
    ['Win %', 'Tỷ lệ thắng', '% de acierto', '% de acerto', '% menang'],
    ['Recovery factor', 'Khả năng hồi vốn', 'Factor de recuperación', 'Fator de recuperação', 'Faktor pemulihan'],
    ['Max drawdown', 'Sụt giảm tối đa', 'Drawdown máximo', 'Drawdown máximo', 'Drawdown maksimum'],
    ['Consistency', 'Độ đều đặn', 'Consistencia', 'Consistência', 'Konsistensi'],
    ['Your Reset Score', 'Reset Score của bạn', 'Tu Reset Score', 'Seu Reset Score', 'Reset Score kamu'],
    ['Plan tracker', 'Theo dõi kế hoạch', 'Seguimiento del plan', 'Acompanhamento do plano', 'Pelacak rencana'],
    ['Followed plan', 'Theo đúng plan', 'Siguió el plan', 'Seguiu o plano', 'Ikuti rencana'],
    ['Broke plan', 'Phá plan', 'Rompió el plan', 'Quebrou o plano', 'Langgar rencana'],
    ['Not answered', 'Chưa trả lời', 'Sin respuesta', 'Sem resposta', 'Belum dijawab'],
    ['days on plan', 'ngày theo plan', 'días según el plan', 'dias no plano', 'hari sesuai rencana'],
    ['Daily net cumulative P&L', 'P&L cộng dồn theo ngày', 'P&L neto acumulado diario', 'P&L líquido acumulado diário', 'P&L bersih kumulatif harian'],
    ['Net daily P&L', 'P&L ròng từng ngày', 'P&L neto diario', 'P&L líquido diário', 'P&L bersih harian'],
    ['Recent trades', 'Lệnh gần đây', 'Operaciones recientes', 'Operações recentes', 'Transaksi terbaru'],
    ['View all', 'Xem tất cả', 'Ver todo', 'Ver tudo', 'Lihat semua'],
    ['Date', 'Ngày', 'Fecha', 'Data', 'Tanggal'],
    ['Symbol', 'Mã', 'Símbolo', 'Ativo', 'Simbol'],
    ['Account balance', 'Số dư tài khoản', 'Saldo de la cuenta', 'Saldo da conta', 'Saldo akun'],
    ['Model Performance', 'Hiệu quả mô hình', 'Rendimiento de modelos', 'Desempenho dos modelos', 'Kinerja model'],
    ['few', 'ít', 'pocos', 'poucos', 'sedikit'],
    ['No model', 'Không mô hình', 'Sin modelo', 'Sem modelo', 'Tanpa model'],
    ['Month:', 'Tháng:', 'Mes:', 'Mês:', 'Bulan:'],
    ['No trades', 'Không có lệnh', 'Sin operaciones', 'Sem operações', 'Tidak ada transaksi'],
    ['No trades yet.', 'Chưa có lệnh.', 'Aún no hay operaciones.', 'Ainda sem operações.', 'Belum ada transaksi.'],
    ['No trades in this period.', 'Không có lệnh trong kỳ này.', 'Sin operaciones en este período.', 'Sem operações neste período.', 'Tidak ada transaksi di periode ini.'],
    ['Closed trades', 'Lệnh đã đóng', 'Operaciones cerradas', 'Operações fechadas', 'Transaksi selesai'],
    ['Under 20 trades: too few to trust yet', 'Dưới 20 lệnh: chưa đủ để tin', 'Menos de 20 operaciones: aún muy pocas', 'Menos de 20 operações: ainda poucas', 'Kurang dari 20 transaksi: belum cukup'],
    ['Previous month', 'Tháng trước', 'Mes anterior', 'Mês anterior', 'Bulan sebelumnya'],
    ['Next month', 'Tháng sau', 'Mes siguiente', 'Próximo mês', 'Bulan berikutnya'],
    ['Previous week', 'Tuần trước', 'Semana anterior', 'Semana anterior', 'Minggu sebelumnya'],
    ['Next week', 'Tuần sau', 'Semana siguiente', 'Próxima semana', 'Minggu berikutnya'],
    ['Mon', 'T2', 'Lun', 'Seg', 'Sen'], ['Tue', 'T3', 'Mar', 'Ter', 'Sel'], ['Wed', 'T4', 'Mié', 'Qua', 'Rab'],
    ['Thu', 'T5', 'Jue', 'Qui', 'Kam'], ['Fri', 'T6', 'Vie', 'Sex', 'Jum'], ['Sat', 'T7', 'Sáb', 'Sáb', 'Sab'], ['Sun', 'CN', 'Dom', 'Dom', 'Min'],
    ['Mo', 'T2', 'Lu', 'Se', 'Sn'], ['Tu', 'T3', 'Ma', 'Te', 'Sl'], ['We', 'T4', 'Mi', 'Qa', 'Rb'],
    ['Th', 'T5', 'Ju', 'Qi', 'Km'], ['Fr', 'T6', 'Vi', 'Sx', 'Jm'], ['Sa', 'T7', 'Sá', 'Sb', 'Sb'], ['Su', 'CN', 'Do', 'Do', 'Mg'],
    ['Prop · Evaluation', 'Prop · Thi', 'Prop · Evaluación', 'Prop · Avaliação', 'Prop · Evaluasi'],
    ['Prop · Funded', 'Prop · Được cấp vốn', 'Prop · Fondeada', 'Prop · Financiada', 'Prop · Didanai'],
    ['Personal · Live', 'Cá nhân · Live', 'Personal · Real', 'Pessoal · Real', 'Pribadi · Live'],
    ['Personal · Demo', 'Cá nhân · Demo', 'Personal · Demo', 'Pessoal · Demo', 'Pribadi · Demo'],
    ['Evaluation', 'Thi', 'Evaluación', 'Avaliação', 'Evaluasi'], ['Funded', 'Được cấp vốn', 'Fondeada', 'Financiada', 'Didanai'], ['Personal', 'Cá nhân', 'Personal', 'Pessoal', 'Pribadi'],
    // Nhật ký ngày
    ['Collapse all', 'Thu gọn tất cả', 'Contraer todo', 'Recolher tudo', 'Ciutkan semua'],
    ['Expand all', 'Mở rộng tất cả', 'Expandir todo', 'Expandir tudo', 'Bentangkan semua'],
    ['Add note', 'Thêm ghi chú', 'Añadir nota', 'Adicionar nota', 'Tambah catatan'],
    ['Total trades', 'Tổng số lệnh', 'Total de operaciones', 'Total de operações', 'Total transaksi'],
    ['Winners', 'Lệnh thắng', 'Ganadoras', 'Vencedoras', 'Menang'],
    ['Losers', 'Lệnh thua', 'Perdedoras', 'Perdedoras', 'Kalah'],
    ['Total R', 'Tổng R', 'R total', 'R total', 'Total R'],
    ['Winrate', 'Tỷ lệ thắng', '% de acierto', '% de acerto', '% menang'],
    ['Quick result', 'Kết quả nhanh', 'Resultado rápido', 'Resultado rápido', 'Hasil cepat'],
    ['trades', 'lệnh', 'operaciones', 'operações', 'transaksi'],
    ['and/or', 'và/hoặc', 'y/o', 'e/ou', 'dan/atau'],
    ['+ Add trade', '+ Thêm lệnh', '+ Añadir operación', '+ Adicionar operação', '+ Tambah transaksi'],
    ['Quick entry', 'Nhập nhanh', 'Entrada rápida', 'Entrada rápida', 'Input cepat'],
    // Trang Trades
    ['All models', 'Tất cả mô hình', 'Todos los modelos', 'Todos os modelos', 'Semua model'],
    ['All mistakes', 'Tất cả lỗi', 'Todos los errores', 'Todos os erros', 'Semua kesalahan'],
    ['Win / Loss', 'Thắng / Thua', 'Ganancia / Pérdida', 'Ganho / Perda', 'Menang / Kalah'],
    ['Wins', 'Thắng', 'Ganadoras', 'Ganhos', 'Menang'],
    ['Losses', 'Thua', 'Pérdidas', 'Perdas', 'Kalah'],
    ['Breakeven', 'Hoà vốn', 'Punto de equilibrio', 'Empate', 'Impas'],
    ['Open', 'Mở', 'Abrir', 'Abrir', 'Buka'],
    ['Followed plan?', 'Theo plan?', '¿Siguió el plan?', 'Seguiu o plano?', 'Ikuti rencana?'],
    ['Plan', 'Plan', 'Plan', 'Plano', 'Rencana'],
    ['Delete', 'Xoá', 'Eliminar', 'Excluir', 'Hapus'],
    ['Clear', 'Bỏ chọn', 'Limpiar', 'Limpar', 'Bersihkan'],
    ['Edit', 'Sửa', 'Editar', 'Editar', 'Ubah'],
    ['No chart yet', 'Chưa có ảnh chart', 'Aún sin gráfico', 'Ainda sem gráfico', 'Belum ada grafik'],
    ['No trades match these filters.', 'Không có lệnh nào khớp bộ lọc.', 'Ninguna operación coincide con estos filtros.', 'Nenhuma operação corresponde a estes filtros.', 'Tidak ada transaksi yang cocok.'],
    ['Tip: drag across cards to select several. ⌘+A selects all.', 'Mẹo: kéo chuột qua các thẻ để chọn nhiều. ⌘+A chọn tất cả.', 'Consejo: arrastra sobre las tarjetas para elegir varias. ⌘+A elige todas.', 'Dica: arraste sobre os cartões para selecionar vários. ⌘+A seleciona todos.', 'Tips: seret di atas kartu untuk memilih beberapa. ⌘+A memilih semua.'],
    ['Tip: drag across cards to select several. Ctrl+A selects all.', 'Mẹo: kéo chuột qua các thẻ để chọn nhiều. Ctrl+A chọn tất cả.', 'Consejo: arrastra sobre las tarjetas para elegir varias. Ctrl+A elige todas.', 'Dica: arraste sobre os cartões para selecionar vários. Ctrl+A seleciona todos.', 'Tips: seret di atas kartu untuk memilih beberapa. Ctrl+A memilih semua.'],
    // Cảm xúc, lỗi
    ['Revenge Trading', 'Gỡ gạc (revenge)', 'Trading de venganza', 'Trade de vingança', 'Balas dendam'],
    ['Overconfidence', 'Quá tự tin', 'Exceso de confianza', 'Excesso de confiança', 'Terlalu percaya diri'],
    ['Fear of Losing', 'Sợ thua', 'Miedo a perder', 'Medo de perder', 'Takut rugi'],
    ['Greed', 'Tham', 'Codicia', 'Ganância', 'Serakah'],
    ['Impatience', 'Thiếu kiên nhẫn', 'Impaciencia', 'Impaciência', 'Tidak sabar'],
    ['Outcome Bias', 'Thiên kiến kết quả', 'Sesgo de resultado', 'Viés de resultado', 'Bias hasil'],
    ['Confirmation Bias', 'Thiên kiến xác nhận', 'Sesgo de confirmación', 'Viés de confirmação', 'Bias konfirmasi'],
    ['Sized up after loss', 'Tăng size sau khi thua', 'Subió el tamaño tras perder', 'Aumentou a mão após perda', 'Naikkan lot setelah rugi'],
    ['Moved to BE too early', 'Dời BE quá sớm', 'Movió a BE muy pronto', 'Moveu para BE cedo demais', 'Pindah ke BE terlalu cepat'],
    ['Calm', 'Bình tĩnh', 'Tranquilo', 'Calmo', 'Tenang'],
    ['Focused', 'Tập trung', 'Concentrado', 'Focado', 'Fokus'],
    ['Anxious', 'Lo lắng', 'Ansioso', 'Ansioso', 'Cemas'],
    ['Impatient', 'Nóng vội', 'Impaciente', 'Impaciente', 'Tidak sabar'],
    ['Bored', 'Chán', 'Aburrido', 'Entediado', 'Bosan'],
    ['Want to win back losses', 'Muốn gỡ lại', 'Quiero recuperar pérdidas', 'Quero recuperar perdas', 'Ingin balik modal'],
    ['Overconfident', 'Quá tự tin', 'Demasiado confiado', 'Confiante demais', 'Terlalu percaya diri'],
    ['Tired', 'Mệt', 'Cansado', 'Cansado', 'Lelah'],
    // Models & Review
    ['Models & Review', 'Mô hình & Đánh giá', 'Modelos y revisión', 'Modelos e revisão', 'Model & Tinjauan'],
    ['Look back at a week or a month: which model, PDA and entry really work for you.', 'Nhìn lại một tuần hoặc một tháng: mô hình, PDA và cách vào lệnh nào thật sự hiệu quả với bạn.', 'Revisa una semana o un mes: qué modelo, PDA y entrada te funcionan de verdad.', 'Revise uma semana ou um mês: qual modelo, PDA e entrada realmente funcionam para você.', 'Tinjau seminggu atau sebulan: model, PDA, dan entry mana yang benar-benar berhasil.'],
    ['Avg R', 'R trung bình', 'R medio', 'R médio', 'Rata-rata R'],
    ['Net', 'Ròng', 'Neto', 'Líquido', 'Bersih'],
    ['win', 'thắng', 'acierto', 'acerto', 'menang'],
    ['New model', 'Mô hình mới', 'Nuevo modelo', 'Novo modelo', 'Model baru'],
    ['Breakdown', 'Phân tích chi tiết', 'Desglose', 'Detalhamento', 'Rincian'],
    ['1 · Daily target', '1 · Mục tiêu ngày', '1 · Objetivo diario', '1 · Alvo diário', '1 · Target harian'],
    ['2 · HTF zone', '2 · Vùng HTF', '2 · Zona HTF', '2 · Zona HTF', '2 · Zona HTF'],
    ['3 · Structure', '3 · Cấu trúc', '3 · Estructura', '3 · Estrutura', '3 · Struktur'],
    ['4 · Entry', '4 · Vào lệnh', '4 · Entrada', '4 · Entrada', '4 · Entry'],
    ['Which daily target does price really reach for you?', 'Giá thật sự chạm mục tiêu ngày nào?', '¿Qué objetivo diario alcanza realmente el precio?', 'Qual alvo diário o preço realmente atinge?', 'Target harian mana yang benar-benar tercapai?'],
    ['Which HTF zone works best for you?', 'Vùng HTF nào hiệu quả nhất với bạn?', '¿Qué zona HTF te funciona mejor?', 'Qual zona HTF funciona melhor para você?', 'Zona HTF mana yang paling berhasil?'],
    ['Do you win more when structure agrees with your HTF Bias?', 'Bạn có thắng nhiều hơn khi cấu trúc thuận HTF Bias không?', '¿Ganas más cuando la estructura va con tu HTF Bias?', 'Você ganha mais quando a estrutura segue seu HTF Bias?', 'Apakah kamu lebih sering menang saat struktur searah HTF Bias?'],
    ['Which entry works best for you?', 'Cách vào lệnh nào hiệu quả nhất với bạn?', '¿Qué entrada te funciona mejor?', 'Qual entrada funciona melhor para você?', 'Entry mana yang paling berhasil?'],
    ['Best so far:', 'Tốt nhất hiện tại:', 'Mejor hasta ahora:', 'Melhor até agora:', 'Terbaik sejauh ini:'],
    ['vs prev', 'so kỳ trước', 'vs anterior', 'vs anterior', 'vs sebelumnya'],
    ['With HTF Bias', 'Thuận HTF Bias', 'A favor del HTF Bias', 'A favor do HTF Bias', 'Searah HTF Bias'],
    ['Against HTF Bias', 'Ngược HTF Bias', 'En contra del HTF Bias', 'Contra o HTF Bias', 'Berlawanan HTF Bias'],
    ['Sideways', 'Đi ngang', 'Lateral', 'Lateral', 'Sideways'],
    ['H4 + H1 confluence', 'Hợp lưu H4 + H1', 'Confluencia H4 + H1', 'Confluência H4 + H1', 'Konfluensi H4 + H1'],
    ['H4 only', 'Chỉ H4', 'Solo H4', 'Só H4', 'Hanya H4'],
    ['H1 only', 'Chỉ H1', 'Solo H1', 'Só H1', 'Hanya H1'],
    ['Now', 'Hiện tại', 'Ahora', 'Agora', 'Sekarang'],
    ['Add', 'Thêm', 'Añadir', 'Adicionar', 'Tambah'],
    ['Save', 'Lưu', 'Guardar', 'Salvar', 'Simpan'],
    ['Cancel', 'Huỷ', 'Cancelar', 'Cancelar', 'Batal'],
    ['Rename', 'Đổi tên', 'Renombrar', 'Renomear', 'Ganti nama'],
    ['Close', 'Đóng', 'Cerrar', 'Fechar', 'Tutup'],
    ['Done', 'Xong', 'Listo', 'Pronto', 'Selesai'],
    // Tài khoản
    ['+ New account', '+ Tài khoản mới', '+ Nueva cuenta', '+ Nova conta', '+ Akun baru'],
    ['Live P&L', 'P&L Live', 'P&L real', 'P&L real', 'P&L Live'],
    ['No Live account yet', 'Chưa có tài khoản Live', 'Aún no hay cuenta real', 'Ainda sem conta real', 'Belum ada akun Live'],
    ['Prop fees paid', 'Phí prop đã trả', 'Tarifas prop pagadas', 'Taxas prop pagas', 'Biaya prop dibayar'],
    ['Net cash', 'Tiền mặt ròng', 'Efectivo neto', 'Caixa líquido', 'Kas bersih'],
    ['Live P&L − prop fees', 'P&L Live − phí prop', 'P&L real − tarifas prop', 'P&L real − taxas prop', 'P&L Live − biaya prop'],
    ['Demo P&L', 'P&L Demo', 'P&L demo', 'P&L demo', 'P&L Demo'],
    ['No Demo account yet', 'Chưa có tài khoản Demo', 'Aún no hay cuenta demo', 'Ainda sem conta demo', 'Belum ada akun Demo'],
    ['Active', 'Đang dùng', 'Activa', 'Ativa', 'Aktif'],
    ['Closed', 'Đã đóng', 'Cerrada', 'Encerrada', 'Ditutup'],
    ['1. What kind of account?', '1. Loại tài khoản nào?', '1. ¿Qué tipo de cuenta?', '1. Que tipo de conta?', '1. Jenis akun apa?'],
    ['2. Details', '2. Thông tin', '2. Detalles', '2. Detalhes', '2. Detail'],
    ['Account type', 'Loại tài khoản', 'Tipo de cuenta', 'Tipo de conta', 'Jenis akun'],
    ['Add your accounts', 'Thêm tài khoản của bạn', 'Añade tus cuentas', 'Adicione suas contas', 'Tambahkan akunmu'],
    // Notebook
    ['Free notes and day notes in one place. Everything saves by itself.', 'Ghi chú tự do và ghi chú ngày ở một chỗ. Mọi thứ tự lưu.', 'Notas libres y notas del día en un solo lugar. Todo se guarda solo.', 'Notas livres e notas do dia em um só lugar. Tudo salva sozinho.', 'Catatan bebas dan catatan harian di satu tempat. Semua tersimpan otomatis.'],
    ['+ Add folder', '+ Thêm thư mục', '+ Añadir carpeta', '+ Adicionar pasta', '+ Tambah folder'],
    ['Folders', 'Thư mục', 'Carpetas', 'Pastas', 'Folder'],
    ['All notes', 'Tất cả ghi chú', 'Todas las notas', 'Todas as notas', 'Semua catatan'],
    ['Day notes', 'Ghi chú ngày', 'Notas del día', 'Notas do dia', 'Catatan harian'],
    ['+ New note', '+ Ghi chú mới', '+ Nueva nota', '+ Nova nota', '+ Catatan baru'],
    ['No notes here yet.', 'Chưa có ghi chú nào.', 'Aún no hay notas.', 'Ainda sem notas.', 'Belum ada catatan.'],
    ['Select a note, or create a new one.', 'Chọn một ghi chú, hoặc tạo ghi chú mới.', 'Elige una nota o crea una nueva.', 'Escolha uma nota ou crie uma nova.', 'Pilih catatan, atau buat yang baru.'],
    ['Search notes', 'Tìm ghi chú', 'Buscar notas', 'Buscar notas', 'Cari catatan'],
    // Settings
    ['Saved on this computer', 'Lưu trên máy này', 'Guardado en este ordenador', 'Salvo neste computador', 'Tersimpan di komputer ini'],
    ['Appearance', 'Giao diện', 'Apariencia', 'Aparência', 'Tampilan'],
    ['Time zone', 'Múi giờ', 'Zona horaria', 'Fuso horário', 'Zona waktu'],
    ['New York', 'New York', 'Nueva York', 'Nova York', 'New York'],
    ['My computer', 'Máy của mình', 'Mi ordenador', 'Meu computador', 'Komputer saya'],
    ['Decides what counts as "today" on the calendar and the default time for a new trade. Saved trades keep their dates.',
      'Quyết định ngày nào là "hôm nay" trên lịch và giờ mặc định khi thêm lệnh. Lệnh đã lưu giữ nguyên ngày.',
      'Define qué cuenta como "hoy" en el calendario y la hora predeterminada de una operación nueva. Las operaciones guardadas conservan sus fechas.',
      'Define o que conta como "hoje" no calendário e a hora padrão de uma nova operação. As operações salvas mantêm suas datas.',
      'Menentukan hari mana yang dihitung "hari ini" di kalender dan jam default untuk transaksi baru. Transaksi yang sudah tersimpan tetap pada tanggalnya.'],
    ['Time (local)', 'Giờ (máy)', 'Hora (local)', 'Hora (local)', 'Waktu (lokal)'],
    ['New York date', 'ngày theo giờ New York', 'fecha de Nueva York', 'data de Nova York', 'tanggal New York'],
    ['your date', 'ngày theo giờ máy', 'tu fecha', 'sua data', 'tanggal Anda'],
    ['Dark', 'Tối', 'Oscuro', 'Escuro', 'Gelap'],
    ['Light', 'Sáng', 'Claro', 'Claro', 'Terang'],
    ['Language', 'Ngôn ngữ', 'Idioma', 'Idioma', 'Bahasa'],
    ['Choose your preferred language', 'Chọn ngôn ngữ bạn muốn dùng', 'Elige tu idioma preferido', 'Escolha seu idioma preferido', 'Pilih bahasa yang kamu inginkan'],
    ['Trash', 'Thùng rác', 'Papelera', 'Lixeira', 'Sampah'],
    ['Deleted trades and notes stay here for 30 days, then they are gone for good. You can also press', 'Lệnh và ghi chú đã xoá nằm đây 30 ngày, sau đó bị xoá hẳn. Bạn cũng có thể nhấn', 'Las operaciones y notas eliminadas quedan aquí 30 días y luego se borran para siempre. También puedes pulsar', 'Operações e notas excluídas ficam aqui por 30 dias e depois somem de vez. Você também pode apertar', 'Transaksi dan catatan yang dihapus disimpan di sini 30 hari, lalu hilang permanen. Kamu juga bisa menekan'],
    ['right after deleting.', 'ngay sau khi xoá.', 'justo después de eliminar.', 'logo após excluir.', 'tepat setelah menghapus.'],
    ['Trash is empty.', 'Thùng rác trống.', 'La papelera está vacía.', 'A lixeira está vazia.', 'Sampah kosong.'],
    ['Restore all', 'Khôi phục tất cả', 'Restaurar todo', 'Restaurar tudo', 'Pulihkan semua'],
    ['Empty trash', 'Dọn sạch thùng rác', 'Vaciar papelera', 'Esvaziar lixeira', 'Kosongkan sampah'],
    ['Restore', 'Khôi phục', 'Restaurar', 'Restaurar', 'Pulihkan'],
    ['Delete forever', 'Xoá vĩnh viễn', 'Eliminar para siempre', 'Excluir para sempre', 'Hapus permanen'],
    ['Delete all trades', 'Xoá tất cả lệnh', 'Eliminar todas las operaciones', 'Excluir todas as operações', 'Hapus semua transaksi'],
    ['Type', 'Gõ', 'Escribe', 'Digite', 'Ketik'],
    ['to confirm', 'để xác nhận', 'para confirmar', 'para confirmar', 'untuk konfirmasi'],
    ['somewhere safe.', 'ra một chỗ an toàn.', 'en un lugar seguro.', 'em um lugar seguro.', 'ke tempat yang aman.'],
    // Form lệnh
    ['Edit trade', 'Sửa lệnh', 'Editar operación', 'Editar operação', 'Ubah transaksi'],
    ['← Back', '← Quay lại', '← Volver', '← Voltar', '← Kembali'],
    ['← Trades', '← Lệnh', '← Operaciones', '← Operações', '← Transaksi'],
    ['Trade', 'Lệnh', 'Operación', 'Operação', 'Transaksi'],
    ['Time (NY)', 'Giờ (NY)', 'Hora (NY)', 'Hora (NY)', 'Waktu (NY)'],
    ['Session', 'Phiên', 'Sesión', 'Sessão', 'Sesi'],
    ['Account', 'Tài khoản', 'Cuenta', 'Conta', 'Akun'],
    ['— No account —', '— Không tài khoản —', '— Sin cuenta —', '— Sem conta —', '— Tanpa akun —'],
    ['Direction', 'Hướng', 'Dirección', 'Direção', 'Arah'],
    ['Risk ($)', 'Rủi ro ($)', 'Riesgo ($)', 'Risco ($)', 'Risiko ($)'],
    ['Contracts', 'Hợp đồng', 'Contratos', 'Contratos', 'Kontrak'],
    ['Result in R', 'Kết quả theo R', 'Resultado en R', 'Resultado em R', 'Hasil dalam R'],
    ['Enter P&L', 'Nhập P&L', 'Introduce el P&L', 'Informe o P&L', 'Masukkan P&L'],
    ['Enter risk and P&L', 'Nhập rủi ro và P&L', 'Introduce riesgo y P&L', 'Informe risco e P&L', 'Masukkan risiko dan P&L'],
    ['News today?', 'Có tin hôm nay?', '¿Noticias hoy?', 'Notícias hoje?', 'Ada berita hari ini?'],
    ['No news', 'Không có tin', 'Sin noticias', 'Sem notícias', 'Tidak ada berita'],
    ['High-impact', 'Tin mạnh', 'Alto impacto', 'Alto impacto', 'Dampak tinggi'],
    ['High-impact news', 'Có tin mạnh', 'Noticias de alto impacto', 'Notícias de alto impacto', 'Berita berdampak tinggi'],
    ['News (optional)', 'Tin (không bắt buộc)', 'Noticia (opcional)', 'Notícia (opcional)', 'Berita (opsional)'],
    ['Setup', 'Thiết lập', 'Setup', 'Setup', 'Setup'],
    ['Structure', 'Cấu trúc', 'Estructura', 'Estrutura', 'Struktur'],
    ['Entry', 'Vào lệnh', 'Entrada', 'Entrada', 'Entry'],
    ['Daily target', 'Mục tiêu ngày', 'Objetivo diario', 'Alvo diário', 'Target harian'],
    ['Daily target (DOL)', 'Mục tiêu ngày (DOL)', 'Objetivo diario (DOL)', 'Alvo diário (DOL)', 'Target harian (DOL)'],
    ['Bullish', 'Tăng', 'Alcista', 'Altista', 'Bullish'],
    ['Bearish', 'Giảm', 'Bajista', 'Baixista', 'Bearish'],
    ['Undecided', 'Chưa rõ', 'Indeciso', 'Indefinido', 'Belum jelas'],
    ['on', 'trên', 'en', 'em', 'di'],
    ['Both = H4 and H1 line up', 'Chọn cả hai = H4 và H1 hợp lưu', 'Ambos = H4 y H1 coinciden', 'Ambos = H4 e H1 coincidem', 'Keduanya = H4 dan H1 searah'],
    ['Entry on', 'Vào lệnh trên', 'Entrada en', 'Entrada em', 'Entry di'],
    ['Confirmation', 'Xác nhận', 'Confirmación', 'Confirmação', 'Konfirmasi'],
    ['Model', 'Mô hình', 'Modelo', 'Modelo', 'Model'],
    ['Edit models', 'Sửa mô hình', 'Editar modelos', 'Editar modelos', 'Ubah model'],
    ['Create a model', 'Tạo mô hình', 'Crear un modelo', 'Criar um modelo', 'Buat model'],
    ['Context', 'Bối cảnh', 'Contexto', 'Contexto', 'Konteks'],
    ['Review', 'Đánh giá', 'Revisión', 'Revisão', 'Tinjauan'],
    ['Did I follow my plan?', 'Mình có theo plan không?', '¿Seguí mi plan?', 'Segui meu plano?', 'Apakah saya ikuti rencana?'],
    ['Yes', 'Có', 'Sí', 'Sim', 'Ya'],
    ['No', 'Không', 'No', 'Não', 'Tidak'],
    ['What made me change my plan?', 'Điều gì khiến mình đổi plan?', '¿Qué me hizo cambiar el plan?', 'O que me fez mudar o plano?', 'Apa yang membuat saya mengubah rencana?'],
    ['How did I feel before entry?', 'Trước khi vào lệnh mình cảm thấy thế nào?', '¿Cómo me sentía antes de entrar?', 'Como eu me sentia antes de entrar?', 'Bagaimana perasaan saya sebelum entry?'],
    ['Mistakes', 'Lỗi', 'Errores', 'Erros', 'Kesalahan'],
    ["Lesson / what I'd do differently", 'Bài học / lần sau làm khác thế nào', 'Lección / qué haría distinto', 'Lição / o que eu faria diferente', 'Pelajaran / apa yang akan saya lakukan berbeda'],
    ['Charts', 'Ảnh chart', 'Gráficos', 'Gráficos', 'Grafik'],
    ['Add image', 'Thêm ảnh', 'Añadir imagen', 'Adicionar imagem', 'Tambah gambar'],
    ['or paste with ⌘V · drop files here', 'hoặc dán bằng ⌘V · kéo thả file vào đây', 'o pega con ⌘V · suelta archivos aquí', 'ou cole com ⌘V · solte arquivos aqui', 'atau tempel dengan ⌘V · seret file ke sini'],
    ['or paste with Ctrl+V · drop files here', 'hoặc dán bằng Ctrl+V · kéo thả file vào đây', 'o pega con Ctrl+V · suelta archivos aquí', 'ou cole com Ctrl+V · solte arquivos aqui', 'atau tempel dengan Ctrl+V · seret file ke sini'],
    ['Save trade', 'Lưu lệnh', 'Guardar operación', 'Salvar operação', 'Simpan transaksi'],
    ['Saving...', 'Đang lưu...', 'Guardando...', 'Salvando...', 'Menyimpan...'],
    ['Aligned with HTF Bias', 'Thuận HTF Bias', 'A favor del HTF Bias', 'A favor do HTF Bias', 'Searah HTF Bias'],
    ['Not aligned with HTF Bias', 'Ngược HTF Bias', 'En contra del HTF Bias', 'Contra o HTF Bias', 'Tidak searah HTF Bias'],
    ['Pick an HTF Bias to check alignment', 'Chọn HTF Bias để kiểm tra thuận/ngược', 'Elige un HTF Bias para comprobar', 'Escolha um HTF Bias para verificar', 'Pilih HTF Bias untuk mengecek'],
    ['aligned', 'thuận', 'a favor', 'a favor', 'searah'],
    ['not aligned', 'ngược', 'en contra', 'contra', 'tidak searah'],
    ['e.g. 100 or -50', 'VD 100 hoặc -50', 'p. ej. 100 o -50', 'ex.: 100 ou -50', 'mis. 100 atau -50'],
    ['e.g. 50', 'VD 50', 'p. ej. 50', 'ex.: 50', 'mis. 50'],
    ['e.g. CPI 8:30', 'VD CPI 8:30', 'p. ej. CPI 8:30', 'ex.: CPI 8:30', 'mis. CPI 8:30'],
    ['+ Add', '+ Thêm', '+ Añadir', '+ Adicionar', '+ Tambah'],
    ['Add your own', 'Tự thêm', 'Añade el tuyo', 'Adicione o seu', 'Tambah sendiri'],
    ['Optional. e.g. Ranging since London, swept Asia low', 'Không bắt buộc. VD đi ngang từ phiên London, quét đáy Asia', 'Opcional. p. ej. Rango desde Londres, barrió el mínimo de Asia', 'Opcional. ex.: Lateral desde Londres, varreu a mínima da Ásia', 'Opsional. mis. Sideways sejak London, sapu low Asia'],
    ['e.g. Lost 2 in a row and wanted it back / Price moved fast without me', 'VD thua 2 lệnh liền và muốn gỡ / giá chạy nhanh mà mình chưa vào', 'p. ej. Perdí 2 seguidas y quise recuperar / el precio se fue sin mí', 'ex.: Perdi 2 seguidas e quis recuperar / o preço andou sem mim', 'mis. Kalah 2 kali beruntun dan ingin balik modal / harga bergerak cepat tanpa saya'],
    ['Type…', 'Gõ chữ…', 'Escribe…', 'Digite…', 'Ketik…'],
    // Trang chi tiết lệnh
    ['Risk', 'Rủi ro', 'Riesgo', 'Risco', 'Risiko'],
    ['HTF Bias (H1/H4)', 'HTF Bias (H1/H4)', 'HTF Bias (H1/H4)', 'HTF Bias (H1/H4)', 'HTF Bias (H1/H4)'],
    ['Market Context', 'Bối cảnh thị trường', 'Contexto de mercado', 'Contexto de mercado', 'Konteks pasar'],
    ['Felt before entry', 'Cảm xúc trước khi vào', 'Sensación antes de entrar', 'Sensação antes de entrar', 'Perasaan sebelum entry'],
    ['Followed my plan?', 'Theo plan?', '¿Seguí mi plan?', 'Segui meu plano?', 'Ikuti rencana?'],
    ['Lesson', 'Bài học', 'Lección', 'Lição', 'Pelajaran'],
    ['Hindsight', 'Nhìn lại', 'En retrospectiva', 'Em retrospecto', 'Refleksi'],
    ['Click to zoom in or draw on this chart', 'Bấm để phóng to hoặc vẽ lên chart này', 'Haz clic para ampliar o dibujar en este gráfico', 'Clique para ampliar ou desenhar neste gráfico', 'Klik untuk memperbesar atau menggambar di grafik ini'],
    ['Delete this trade?', 'Xoá lệnh này?', '¿Eliminar esta operación?', 'Excluir esta operação?', 'Hapus transaksi ini?'],
    ['Delete trade', 'Xoá lệnh', 'Eliminar operación', 'Excluir operação', 'Hapus transaksi'],
    // Khung ngày
    ['Day result', 'Kết quả ngày', 'Resultado del día', 'Resultado do dia', 'Hasil hari ini'],
    ['No time to log each trade? Type the day total.', 'Không kịp ghi từng lệnh? Gõ tổng của ngày.', '¿Sin tiempo para cada operación? Escribe el total del día.', 'Sem tempo para cada operação? Digite o total do dia.', 'Tidak sempat mencatat tiap transaksi? Ketik total hari ini.'],
    ['Edit the result you typed for this day.', 'Sửa kết quả bạn đã gõ cho ngày này.', 'Edita el resultado que escribiste para este día.', 'Edite o resultado que você digitou para este dia.', 'Ubah hasil yang kamu ketik untuk hari ini.'],
    ['Calculated from your trades. Edit a trade below to change it.', 'Tính từ các lệnh của bạn. Sửa lệnh bên dưới để thay đổi.', 'Calculado de tus operaciones. Edita una abajo para cambiarlo.', 'Calculado das suas operações. Edite uma abaixo para mudar.', 'Dihitung dari transaksimu. Ubah transaksi di bawah untuk mengganti.'],
    ['Only the $ amount is needed. A losing day? Add a minus: -$80 · RR = risk-to-reward, e.g. 1.5 = you made 1.5× your risk · Enter to save', 'Chỉ cần số tiền $. Ngày lỗ? Thêm dấu trừ: -$80 · RR = lời so với rủi ro, VD 1.5 = lời gấp 1.5 lần rủi ro · Enter để lưu', 'Solo hace falta el importe en $. ¿Día perdedor? Añade un menos: -$80 · RR = riesgo/beneficio, p. ej. 1.5 = ganaste 1.5× tu riesgo · Enter para guardar', 'Só o valor em $ é necessário. Dia de perda? Use o sinal de menos: -$80 · RR = risco/retorno, ex.: 1.5 = ganhou 1.5× o risco · Enter para salvar', 'Cukup jumlah $. Hari rugi? Tambah tanda minus: -$80 · RR = risk-to-reward, mis. 1.5 = untung 1.5× risiko · Enter untuk simpan'],
    ['Day note', 'Ghi chú ngày', 'Nota del día', 'Nota do dia', 'Catatan hari ini'],
    ['Save note', 'Lưu ghi chú', 'Guardar nota', 'Salvar nota', 'Simpan catatan'],
    ['+ Add full trade', '+ Thêm lệnh đầy đủ', '+ Añadir operación completa', '+ Adicionar operação completa', '+ Tambah transaksi lengkap'],
    ['Add full trade', 'Thêm lệnh đầy đủ', 'Añadir operación completa', 'Adicionar operação completa', 'Tambah transaksi lengkap'],
    ['Open day', 'Mở ngày', 'Abrir día', 'Abrir dia', 'Buka hari'],
    ['Delete…', 'Xoá…', 'Eliminar…', 'Excluir…', 'Hapus…'],
    ['optional', 'không bắt buộc', 'opcional', 'opcional', 'opsional'],
    ['e.g. $120', 'VD $120', 'p. ej. $120', 'ex.: $120', 'mis. $120'],
    ['How did the day go? Market, mood, why you sat out…', 'Ngày hôm nay thế nào? Thị trường, tâm trạng, vì sao đứng ngoài…', '¿Cómo fue el día? Mercado, ánimo, por qué no operaste…', 'Como foi o dia? Mercado, humor, por que ficou de fora…', 'Bagaimana hari ini? Pasar, suasana hati, kenapa tidak trading…'],
    // Khung xem ảnh + vẽ
    ['Draw', 'Vẽ', 'Dibujar', 'Desenhar', 'Gambar'],
    ['Delete image', 'Xoá ảnh', 'Eliminar imagen', 'Excluir imagem', 'Hapus gambar'],
    ['Open in new tab', 'Mở tab mới', 'Abrir en otra pestaña', 'Abrir em nova aba', 'Buka di tab baru'],
    ['Replace…', 'Thay ảnh…', 'Reemplazar…', 'Substituir…', 'Ganti…'],
    ['Select', 'Chọn', 'Seleccionar', 'Selecionar', 'Pilih'],
    ['Line', 'Đường', 'Línea', 'Linha', 'Garis'],
    ['Arrow', 'Mũi tên', 'Flecha', 'Seta', 'Panah'],
    ['Box', 'Hộp', 'Caja', 'Caixa', 'Kotak'],
    ['Text', 'Chữ', 'Texto', 'Texto', 'Teks'],
    ['Selected', 'Đang chọn', 'Seleccionado', 'Selecionado', 'Dipilih'],
    ['Opacity', 'Độ trong', 'Opacidad', 'Opacidade', 'Opasitas'],
    ['Width', 'Độ dày', 'Grosor', 'Espessura', 'Ketebalan'],
    ['Border', 'Viền', 'Borde', 'Borda', 'Garis tepi'],
    ['Undo', 'Hoàn tác', 'Deshacer', 'Desfazer', 'Urungkan'],
    ['Bold', 'Đậm', 'Negrita', 'Negrito', 'Tebal'],
    ['Italic', 'Nghiêng', 'Cursiva', 'Itálico', 'Miring'],
    ['Color and opacity', 'Màu và độ trong', 'Color y opacidad', 'Cor e opacidade', 'Warna dan opasitas'],
    ['Custom color', 'Màu tuỳ chọn', 'Color personalizado', 'Cor personalizada', 'Warna kustom'],
    ['Opens the original image, without your drawings', 'Mở ảnh gốc, không có nét vẽ', 'Abre la imagen original, sin tus dibujos', 'Abre a imagem original, sem seus desenhos', 'Membuka gambar asli, tanpa coretanmu'],
    ['Esc to close · Draw to mark up this chart', 'Esc để đóng · bấm Vẽ để đánh dấu chart', 'Esc para cerrar · Dibujar para marcar el gráfico', 'Esc para fechar · Desenhar para marcar o gráfico', 'Esc untuk tutup · Gambar untuk menandai grafik'],
    ['Esc to close · Cmd+V now replaces this image', 'Esc để đóng · Cmd+V sẽ thay ảnh này', 'Esc para cerrar · Cmd+V reemplaza esta imagen', 'Esc para fechar · Cmd+V substitui esta imagem', 'Esc untuk tutup · Cmd+V mengganti gambar ini'],
    ['The image and its drawings are removed from this trade. This cannot be undone.', 'Ảnh và nét vẽ trên ảnh sẽ bị xoá khỏi lệnh này. Không hoàn tác được.', 'La imagen y sus dibujos se quitan de esta operación. No se puede deshacer.', 'A imagem e seus desenhos são removidos desta operação. Não dá para desfazer.', 'Gambar dan coretannya dihapus dari transaksi ini. Tidak bisa dibatalkan.'],
    ['Image deleted', 'Đã xoá ảnh', 'Imagen eliminada', 'Imagem excluída', 'Gambar dihapus'],
    ['Nothing to undo. Deleted items are in Settings → Trash.', 'Không có gì để hoàn tác. Mục đã xoá nằm trong Cài đặt → Thùng rác.', 'Nada que deshacer. Lo eliminado está en Ajustes → Papelera.', 'Nada para desfazer. Itens excluídos estão em Configurações → Lixeira.', 'Tidak ada yang bisa diurungkan. Item terhapus ada di Pengaturan → Sampah.'],
  ];

  // ---------- Mẫu câu có số / chữ thay đổi ----------
  // Mỗi mẫu: [regex, (m) => { vi, es, pt, id }]
  const trades = (n) => ({ vi: `${n} lệnh`, es: `${n} operación${n === '1' ? '' : 'es'}`, pt: `${n} operaç${n === '1' ? 'ão' : 'ões'}`, id: `${n} transaksi` });
  const PERIOD = { 'this week': { vi: 'tuần này', es: 'esta semana', pt: 'esta semana', id: 'minggu ini' }, 'this month': { vi: 'tháng này', es: 'este mes', pt: 'este mês', id: 'bulan ini' }, 'all time': { vi: 'toàn bộ', es: 'todo el tiempo', pt: 'todo o período', id: 'sepanjang waktu' } };
  const PATTERNS = [
    [/^(\d+) trades?$/, (m) => trades(m[1])],
    [/^(\d+) trades? ·$/, (m) => { const t = trades(m[1]); return { vi: `${t.vi} ·`, es: `${t.es} ·`, pt: `${t.pt} ·`, id: `${t.id} ·` }; }],
    [/^(\d+) trades? logged$/, (m) => ({ vi: `Đã ghi ${m[1]} lệnh`, es: `${trades(m[1]).es} registradas`, pt: `${trades(m[1]).pt} registradas`, id: `${m[1]} transaksi tercatat` })],
    [/^(\d+) trades? selected$/, (m) => ({ vi: `Đã chọn ${m[1]} lệnh`, es: `${trades(m[1]).es} seleccionadas`, pt: `${trades(m[1]).pt} selecionadas`, id: `${m[1]} transaksi dipilih` })],
    [/^Based on (\d+) trades? \(not reliable yet\)$/, (m) => ({ vi: `Dựa trên ${m[1]} lệnh (chưa đáng tin)`, es: `Basado en ${trades(m[1]).es} (aún poco fiable)`, pt: `Com base em ${trades(m[1]).pt} (ainda pouco confiável)`, id: `Berdasarkan ${m[1]} transaksi (belum bisa diandalkan)` })],
    [/^Based on (\d+) trades?$/, (m) => ({ vi: `Dựa trên ${m[1]} lệnh`, es: `Basado en ${trades(m[1]).es}`, pt: `Com base em ${trades(m[1]).pt}`, id: `Berdasarkan ${m[1]} transaksi` })],
    [/^Week (\d+)$/, (m) => ({ vi: `Tuần ${m[1]}`, es: `Semana ${m[1]}`, pt: `Semana ${m[1]}`, id: `Minggu ${m[1]}` })],
    [/^Chart (\d+)$/, (m) => ({ vi: `Chart ${m[1]}`, es: `Gráfico ${m[1]}`, pt: `Gráfico ${m[1]}`, id: `Grafik ${m[1]}` })],
    [/^Delete chart (\d+)\?$/, (m) => ({ vi: `Xoá chart ${m[1]}?`, es: `¿Eliminar el gráfico ${m[1]}?`, pt: `Excluir o gráfico ${m[1]}?`, id: `Hapus grafik ${m[1]}?` })],
    [/^prev (.+)$/, (m) => ({ vi: `kỳ trước ${m[1]}`, es: `ant. ${m[1]}`, pt: `ant. ${m[1]}`, id: `sblm ${m[1]}` })],
    [/^Net P&L (.+)$/, (m) => ({ vi: `P&L ròng ${m[1]}`, es: `P&L neto ${m[1]}`, pt: `P&L líquido ${m[1]}`, id: `P&L bersih ${m[1]}` })],
    [/^Net P&L$/, () => ({ vi: 'P&L ròng', es: 'P&L neto', pt: 'P&L líquido', id: 'P&L bersih' })],
    [/^Fee (.+)$/, (m) => ({ vi: `Phí ${m[1]}`, es: `Tarifa ${m[1]}`, pt: `Taxa ${m[1]}`, id: `Biaya ${m[1]}` })],
    [/^Delete (\d+) trades?$/, (m) => ({ vi: `Xoá ${m[1]} lệnh`, es: `Eliminar ${trades(m[1]).es}`, pt: `Excluir ${trades(m[1]).pt}`, id: `Hapus ${m[1]} transaksi` })],
    [/^Delete (\d+)$/, (m) => ({ vi: `Xoá ${m[1]}`, es: `Eliminar ${m[1]}`, pt: `Excluir ${m[1]}`, id: `Hapus ${m[1]}` })],
    [/^· (\d+%) win · (\d+) trades?$/, (m) => ({ vi: `· thắng ${m[1]} · ${m[2]} lệnh`, es: `· ${m[1]} acierto · ${trades(m[2]).es}`, pt: `· ${m[1]} acerto · ${trades(m[2]).pt}`, id: `· ${m[1]} menang · ${m[2]} transaksi` })],
    [/^(\d+) days? · (.+) · (New York|your) dates$/, (m) => (m[3] === 'your'
      ? ({ vi: `${m[1]} ngày · ${m[2]} · ngày theo giờ máy`, es: `${m[1]} días · ${m[2]} · tus fechas`, pt: `${m[1]} dias · ${m[2]} · suas datas`, id: `${m[1]} hari · ${m[2]} · tanggal Anda` })
      : ({ vi: `${m[1]} ngày · ${m[2]} · ngày theo giờ New York`, es: `${m[1]} días · ${m[2]} · fechas de Nueva York`, pt: `${m[1]} dias · ${m[2]} · datas de Nova York`, id: `${m[1]} hari · ${m[2]} · tanggal New York` }))],
    [/^(\d+) losses? in a row today\. Close the charts\. Your session is over\.$/, (m) => ({ vi: `Thua ${m[1]} lệnh liên tiếp hôm nay. Tắt chart đi. Phiên của bạn đã kết thúc.`, es: `${m[1]} pérdidas seguidas hoy. Cierra los gráficos. Tu sesión terminó.`, pt: `${m[1]} perdas seguidas hoje. Feche os gráficos. Sua sessão acabou.`, id: `${m[1]} kali rugi beruntun hari ini. Tutup grafik. Sesimu selesai.` })],
    [/^No trades with (.+) filled in yet\. Fill it in the Setup block when you log a trade\.$/, () => ({ vi: 'Chưa có lệnh nào điền mục này. Hãy điền ở khối Thiết lập khi ghi lệnh.', es: 'Aún no hay operaciones con este dato. Rellénalo en el bloque Setup al registrar una operación.', pt: 'Ainda não há operações com este dado. Preencha no bloco Setup ao registrar uma operação.', id: 'Belum ada transaksi yang mengisi ini. Isi di blok Setup saat mencatat transaksi.' })],
    [/^No closed trades in (.+?)\.( Use ‹ to look at an earlier period\.)?$/, (m) => ({ vi: `Không có lệnh đã đóng trong ${m[1]}.${m[2] ? ' Bấm ‹ để xem kỳ trước.' : ''}`, es: `Sin operaciones cerradas en ${m[1]}.${m[2] ? ' Usa ‹ para ver un período anterior.' : ''}`, pt: `Sem operações fechadas em ${m[1]}.${m[2] ? ' Use ‹ para ver um período anterior.' : ''}`, id: `Tidak ada transaksi selesai di ${m[1]}.${m[2] ? ' Tekan ‹ untuk periode sebelumnya.' : ''}` })],
    [/^· (.+) · Click any day to see trades, add one or write a note$/, (m) => ({ vi: `· ${m[1]} · Bấm vào ngày bất kỳ để xem lệnh, thêm lệnh hoặc ghi chú`, es: `· ${m[1]} · Haz clic en un día para ver operaciones, añadir una o escribir una nota`, pt: `· ${m[1]} · Clique em um dia para ver operações, adicionar uma ou escrever uma nota`, id: `· ${m[1]} · Klik hari mana saja untuk melihat transaksi, menambah, atau menulis catatan` })],
    [/^Click any day to see trades, add one or write a note$/, () => ({ vi: 'Bấm vào ngày bất kỳ để xem lệnh, thêm lệnh hoặc ghi chú', es: 'Haz clic en un día para ver operaciones, añadir una o escribir una nota', pt: 'Clique em um dia para ver operações, adicionar uma ou escrever uma nota', id: 'Klik hari mana saja untuk melihat transaksi, menambah, atau menulis catatan' })],
    [/^(Delete or (?:⌘|Ctrl\+)X) to delete · Right-click for options · Esc to clear$/, (m) => ({ vi: `${m[1].replace('Delete or', 'Delete hoặc')} để xoá · Chuột phải để xem thêm · Esc để bỏ chọn`, es: `${m[1].replace('or', 'o')} para eliminar · Clic derecho para opciones · Esc para limpiar`, pt: `${m[1].replace('or', 'ou')} para excluir · Clique direito para opções · Esc para limpar`, id: `${m[1].replace('or', 'atau')} untuk hapus · Klik kanan untuk opsi · Esc untuk batal` })],
    [/^(Delete or (?:⌘|Ctrl\+)X) removes the selected drawing · (Saved automatically|Saved when you press Save trade)$/, (m) => {
      const auto = m[2] === 'Saved automatically';
      return { vi: `${m[1].replace('Delete or', 'Delete hoặc')} xoá nét đang chọn · ${auto ? 'Tự động lưu' : 'Lưu khi bấm Lưu lệnh'}`, es: `${m[1].replace('or', 'o')} borra el dibujo elegido · ${auto ? 'Se guarda solo' : 'Se guarda al pulsar Guardar operación'}`, pt: `${m[1].replace('or', 'ou')} apaga o desenho selecionado · ${auto ? 'Salvo automaticamente' : 'Salvo ao clicar em Salvar operação'}`, id: `${m[1].replace('or', 'atau')} menghapus coretan terpilih · ${auto ? 'Tersimpan otomatis' : 'Tersimpan saat menekan Simpan transaksi'}` };
    }],
    [/^Or press (Delete or (?:⌘|Ctrl\+)X)$/, (m) => ({ vi: `Hoặc nhấn ${m[1].replace('Delete or', 'Delete hoặc')}`, es: `O pulsa ${m[1].replace('or', 'o')}`, pt: `Ou aperte ${m[1].replace('or', 'ou')}`, id: `Atau tekan ${m[1].replace('or', 'atau')}` })],
    [/^Keep your own money, practice and prop accounts apart\. (\d+) accounts?\.$/, (m) => ({ vi: `Tách riêng tiền thật, tài khoản luyện tập và tài khoản prop. ${m[1]} tài khoản.`, es: `Separa tu dinero, tus cuentas de práctica y las prop. ${m[1]} cuenta(s).`, pt: `Separe seu dinheiro, contas de prática e contas prop. ${m[1]} conta(s).`, id: `Pisahkan uang sendiri, akun latihan, dan akun prop. ${m[1]} akun.` })],
    [/^Money spent on challenges · (\d+) prop accounts?$/, (m) => ({ vi: `Tiền đã chi cho các bài thi · ${m[1]} tài khoản prop`, es: `Dinero gastado en desafíos · ${m[1]} cuenta(s) prop`, pt: `Dinheiro gasto em desafios · ${m[1]} conta(s) prop`, id: `Uang untuk challenge · ${m[1]} akun prop` })],
    [/^Deletes all (\d+) trades? in every account and moves them to Trash\. Accounts and day notes stay\. To keep a full copy, copy the folder$/, (m) => ({ vi: `Xoá cả ${m[1]} lệnh ở mọi tài khoản và chuyển vào Thùng rác. Tài khoản và ghi chú ngày vẫn giữ. Muốn giữ một bản đầy đủ thì chép thư mục`, es: `Elimina las ${m[1]} operaciones de todas las cuentas y las mueve a la Papelera. Las cuentas y notas del día se quedan. Para guardar una copia completa, copia la carpeta`, pt: `Exclui as ${m[1]} operações de todas as contas e as move para a Lixeira. Contas e notas do dia ficam. Para guardar uma cópia completa, copie a pasta`, id: `Menghapus ${m[1]} transaksi di semua akun dan memindahkannya ke Sampah. Akun dan catatan harian tetap ada. Untuk salinan lengkap, salin folder` })],
    [/^Delete from (.+)\?$/, (m) => ({ vi: `Xoá dữ liệu ngày ${m[1]}?`, es: `¿Eliminar del ${m[1]}?`, pt: `Excluir de ${m[1]}?`, id: `Hapus dari ${m[1]}?` })],
    [/^(\d+) trades? \(with chart images\)\. They go to Trash\. Press (⌘|Ctrl\+)Z to undo\.$/, (m) => ({ vi: `${m[1]} lệnh (kèm ảnh chart). Chúng vào Thùng rác. Nhấn ${m[2]}Z để hoàn tác.`, es: `${trades(m[1]).es} (con imágenes). Van a la Papelera. Pulsa ${m[2]}Z para deshacer.`, pt: `${trades(m[1]).pt} (com imagens). Vão para a Lixeira. Aperte ${m[2]}Z para desfazer.`, id: `${m[1]} transaksi (dengan gambar). Masuk ke Sampah. Tekan ${m[2]}Z untuk urungkan.` })],
    // Giải thích (i) có nhắc kỳ đang xem
    [/^Net P&L = everything you made minus everything you lost \((this week|this month|all time)\)\. Example: \+\$334, \+\$60 and −\$154 → \+\$240\. The small number next to the title is how many trades\.$/, (m) => { const p = PERIOD[m[1]]; return {
      vi: `P&L ròng = tổng tiền lời trừ tổng tiền lỗ (${p.vi}).\nVí dụ: +$334, +$60 và −$154 → +$240.\nSố nhỏ cạnh tiêu đề là số lệnh.`,
      es: `P&L neto = todo lo que ganaste menos todo lo que perdiste (${p.es}).\nEjemplo: +$334, +$60 y −$154 → +$240.\nEl número pequeño junto al título es la cantidad de operaciones.`,
      pt: `P&L líquido = tudo que você ganhou menos tudo que perdeu (${p.pt}).\nExemplo: +$334, +$60 e −$154 → +$240.\nO número pequeno ao lado do título é a quantidade de operações.`,
      id: `P&L bersih = semua keuntungan dikurangi semua kerugian (${p.id}).\nContoh: +$334, +$60 dan −$154 → +$240.\nAngka kecil di samping judul adalah jumlah transaksi.` }; }],
    [/^Your running total, day by day \((this week|this month|all time)\)\. Each point adds that day to all the days before it\. Line going up = your account is growing\.$/, (m) => { const p = PERIOD[m[1]]; return {
      vi: `Tổng cộng dồn theo từng ngày (${p.vi}). Mỗi điểm cộng ngày đó vào tất cả các ngày trước.\nĐường đi lên = tài khoản đang tăng.`,
      es: `Tu total acumulado, día a día (${p.es}). Cada punto suma ese día a todos los anteriores.\nLínea que sube = tu cuenta crece.`,
      pt: `Seu total acumulado, dia a dia (${p.pt}). Cada ponto soma aquele dia a todos os anteriores.\nLinha subindo = sua conta está crescendo.`,
      id: `Total berjalan, hari demi hari (${p.id}). Setiap titik menambahkan hari itu ke semua hari sebelumnya.\nGaris naik = akunmu bertumbuh.` }; }],
    [/^The result of each single day \((this week|this month|all time)\)\. Green bar = profitable day\. Red bar = losing day\.$/, (m) => { const p = PERIOD[m[1]]; return {
      vi: `Kết quả của từng ngày (${p.vi}).\nCột xanh = ngày lời. Cột đỏ = ngày lỗ.`,
      es: `El resultado de cada día (${p.es}).\nBarra verde = día ganador. Barra roja = día perdedor.`,
      pt: `O resultado de cada dia (${p.pt}).\nBarra verde = dia de lucro. Barra vermelha = dia de perda.`,
      id: `Hasil setiap hari (${p.id}).\nBatang hijau = hari untung. Batang merah = hari rugi.` }; }],
  ];

  // Câu giải thích (i) cố định
  ROWS.push(
    ['How many of your trades made money. Example: 3 wins out of 4 trades = 75%. Under the gauge: wins · breakeven · losses. A high win % alone does not mean you make money. Check Avg win/loss too.',
      'Bao nhiêu lệnh của bạn có lời.\nVí dụ: thắng 3 trong 4 lệnh = 75%.\nDưới đồng hồ: thắng · hoà · thua.\nTỷ lệ thắng cao chưa chắc đã có lời. Xem thêm Lãi TB / lỗ TB.',
      'Cuántas de tus operaciones ganaron dinero.\nEjemplo: 3 ganadoras de 4 = 75%.\nBajo el indicador: ganadoras · empate · perdedoras.\nUn % alto por sí solo no significa ganar dinero. Mira también la ganancia/pérdida media.',
      'Quantas das suas operações deram lucro.\nExemplo: 3 vencedoras em 4 = 75%.\nAbaixo do medidor: vencedoras · empate · perdedoras.\nUm % alto sozinho não significa lucro. Veja também o ganho/perda médio.',
      'Berapa banyak transaksi yang untung.\nContoh: 3 menang dari 4 = 75%.\nDi bawah indikator: menang · impas · kalah.\n% menang tinggi saja belum tentu untung. Lihat juga rata-rata untung/rugi.'],
    ['Total money won ÷ total money lost. Example: $394 won, $154 lost → 2.56. For every $1 you lose, you make $2.56. Below 1.0 = losing money. Above 1.0 = making money. Needs 20–30 trades before you can trust it.',
      'Tổng tiền lời ÷ tổng tiền lỗ.\nVí dụ: lời $394, lỗ $154 → 2.56. Cứ mất $1 thì bạn kiếm được $2.56.\nDưới 1.0 = đang lỗ. Trên 1.0 = đang lời.\nCần 20–30 lệnh mới đáng tin.',
      'Dinero ganado ÷ dinero perdido.\nEjemplo: $394 ganados, $154 perdidos → 2.56. Por cada $1 que pierdes, ganas $2.56.\nMenos de 1.0 = pierdes dinero. Más de 1.0 = ganas dinero.\nNecesita 20–30 operaciones para ser fiable.',
      'Total ganho ÷ total perdido.\nExemplo: $394 ganhos, $154 perdidos → 2.56. Para cada $1 perdido, você ganha $2.56.\nAbaixo de 1.0 = perdendo dinheiro. Acima de 1.0 = ganhando.\nPrecisa de 20–30 operações para ser confiável.',
      'Total untung ÷ total rugi.\nContoh: untung $394, rugi $154 → 2.56. Setiap rugi $1, kamu dapat $2.56.\nDi bawah 1.0 = rugi. Di atas 1.0 = untung.\nPerlu 20–30 transaksi agar bisa dipercaya.'],
    ['How many of your trading days ended in profit. It counts days, not trades. Example: 3 green days out of 4 = 75%. Under the gauge: green · flat · red days.',
      'Bao nhiêu ngày giao dịch kết thúc có lời. Tính theo ngày, không theo lệnh.\nVí dụ: 3 ngày xanh trong 4 ngày = 75%.\nDưới đồng hồ: ngày xanh · hoà · đỏ.',
      'Cuántos días de trading terminaron en ganancia. Cuenta días, no operaciones.\nEjemplo: 3 días verdes de 4 = 75%.\nBajo el indicador: días verdes · planos · rojos.',
      'Quantos dias de trade terminaram no lucro. Conta dias, não operações.\nExemplo: 3 dias verdes em 4 = 75%.\nAbaixo do medidor: dias verdes · neutros · vermelhos.',
      'Berapa hari trading yang berakhir untung. Dihitung per hari, bukan per transaksi.\nContoh: 3 hari hijau dari 4 = 75%.\nDi bawah indikator: hari hijau · datar · merah.'],
    ['Your average winning trade ÷ your average losing trade. Example: average win $197, average loss $154 → 1.28. Your wins are 1.28× the size of your losses. Below 1.0 = your losses are bigger than your wins, so you need a high win % to make money.',
      'Lệnh thắng trung bình ÷ lệnh thua trung bình.\nVí dụ: thắng TB $197, thua TB $154 → 1.28. Lệnh thắng lớn gấp 1.28 lần lệnh thua.\nDưới 1.0 = lệnh thua lớn hơn lệnh thắng, nên cần tỷ lệ thắng cao mới có lời.',
      'Tu ganancia media ÷ tu pérdida media.\nEjemplo: ganancia media $197, pérdida media $154 → 1.28. Tus ganancias son 1.28× tus pérdidas.\nMenos de 1.0 = tus pérdidas son mayores, así que necesitas un % de acierto alto.',
      'Seu ganho médio ÷ sua perda média.\nExemplo: ganho médio $197, perda média $154 → 1.28. Seus ganhos são 1.28× suas perdas.\nAbaixo de 1.0 = suas perdas são maiores, então você precisa de um % de acerto alto.',
      'Rata-rata untung ÷ rata-rata rugi.\nContoh: rata-rata untung $197, rugi $154 → 1.28. Untungmu 1.28× rugimu.\nDi bawah 1.0 = rugi lebih besar dari untung, jadi perlu % menang yang tinggi.'],
    ['One score from 0 to 100, made from 6 numbers. Hover or tap each label on the chart to see what it means and your own number. It sums up your results. It is not a grade of you as a trader, and it needs 20+ trades to mean much.',
      'Một điểm từ 0 đến 100, tính từ 6 chỉ số.\nRê chuột hoặc chạm vào từng nhãn trên biểu đồ để xem ý nghĩa và số của bạn.\nNó tóm tắt kết quả, không phải điểm chấm bạn là trader giỏi hay dở, và cần 20+ lệnh mới có ý nghĩa.',
      'Una puntuación de 0 a 100 hecha con 6 números.\nPasa el cursor o toca cada etiqueta para ver qué significa y tu número.\nResume tus resultados. No es una nota sobre ti como trader y necesita 20+ operaciones.',
      'Uma nota de 0 a 100 feita com 6 números.\nPasse o mouse ou toque em cada rótulo para ver o significado e seu número.\nResume seus resultados. Não é uma nota sobre você como trader e precisa de 20+ operações.',
      'Satu skor 0 sampai 100 dari 6 angka.\nArahkan atau ketuk tiap label untuk melihat artinya dan angkamu.\nIni ringkasan hasil, bukan nilai dirimu sebagai trader, dan perlu 20+ transaksi.'],
    ['Each square is one day in the last 12 weeks. Green: every trade followed your plan. Red: at least one trade broke your plan. Grey: plan not answered (or a quick day result). Click a square to open that day.',
      'Mỗi ô là một ngày trong 12 tuần gần nhất.\nXanh: mọi lệnh đều theo plan.\nĐỏ: có ít nhất một lệnh phá plan.\nXám: chưa trả lời (hoặc kết quả nhanh).\nBấm vào ô để mở ngày đó.',
      'Cada cuadro es un día de las últimas 12 semanas.\nVerde: todas las operaciones siguieron el plan.\nRojo: al menos una rompió el plan.\nGris: sin respuesta (o resultado rápido).\nHaz clic para abrir ese día.',
      'Cada quadrado é um dia das últimas 12 semanas.\nVerde: todas as operações seguiram o plano.\nVermelho: pelo menos uma quebrou o plano.\nCinza: sem resposta (ou resultado rápido).\nClique para abrir o dia.',
      'Setiap kotak adalah satu hari dalam 12 minggu terakhir.\nHijau: semua transaksi sesuai rencana.\nMerah: setidaknya satu melanggar rencana.\nAbu-abu: belum dijawab (atau hasil cepat).\nKlik untuk membuka hari itu.'],
    ['Account balance = starting balance + the $ result of every trade in that account. Set the starting balance in Accounts (top bar → Manage accounts).',
      'Số dư = số dư ban đầu + kết quả $ của mọi lệnh trong tài khoản đó.\nĐặt số dư ban đầu trong Tài khoản (thanh trên → Quản lý tài khoản).',
      'Saldo = saldo inicial + el resultado en $ de cada operación de esa cuenta.\nConfigura el saldo inicial en Cuentas (barra superior → Gestionar cuentas).',
      'Saldo = saldo inicial + o resultado em $ de cada operação da conta.\nDefina o saldo inicial em Contas (barra superior → Gerenciar contas).',
      'Saldo = saldo awal + hasil $ setiap transaksi di akun itu.\nAtur saldo awal di Akun (bilah atas → Kelola akun).'],
  );

  // ---------- Bộ máy dịch ----------
  const COL = { vi: 1, es: 2, pt: 3, id: 4 }[lang];
  const DICT = new Map();
  if (COL) ROWS.forEach((r) => DICT.set(r[0].replace(/\s+/g, ' ').trim(), r[COL]));
  const tr = (s) => {
    if (!COL || !s) return null;
    const key = s.replace(/\s+/g, ' ').trim();
    if (DICT.has(key)) return DICT.get(key);
    for (const [re, fn] of PATTERNS) { const m = key.match(re); if (m) { const o = fn(m); if (o && o[lang]) return o[lang]; } }
    // Chuỗi ghép bằng " · " hoặc ", " (VD "chủ dự án 25k · Prop · Evaluation", "Calm, Focused"): dịch từng phần
    for (const sep of [' · ', ', ']) {
      if (!key.includes(sep)) continue;
      const lead = key.startsWith('· ') ? '· ' : '';
      const parts = (lead ? key.slice(2) : key).split(sep);
      let changed = false;
      const out = parts.map((p) => { const r = DICT.get(p.trim()); if (r != null) { changed = true; return r; } return p; });
      if (changed) return lead + out.join(sep);
    }
    if (key.startsWith('· ') && DICT.has(key.slice(2))) return `· ${DICT.get(key.slice(2))}`;
    return null;
  };
  const SKIP = 'script, style, textarea, input, [contenteditable="true"], [data-no-i18n], .anno-svg, svg.anno-svgimg';
  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip'];
  function trText(n) {
    const raw = n.nodeValue; if (!raw || !/[A-Za-z]/.test(raw)) return;
    const p = n.parentElement; if (!p || p.closest(SKIP)) return;
    const r = tr(raw); if (r == null) return;
    const lead = raw.match(/^\s*/)[0]; const trail = raw.match(/\s*$/)[0];
    const next = lead + r + trail; if (next !== raw) n.nodeValue = next;
  }
  function trAttrs(el) {
    if (el.closest && el.closest('[data-no-i18n]')) return;
    for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && /[A-Za-z]/.test(v)) { const r = tr(v); if (r != null && r !== v) el.setAttribute(a, r); } }
  }
  function walk(root) {
    if (!COL || !root) return;
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1) return;
    trAttrs(root);
    root.querySelectorAll('[placeholder],[title],[aria-label],[data-tip]').forEach(trAttrs);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) trText(n);
  }
  if (COL) {
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') trText(m.target);
        else if (m.type === 'attributes') trAttrs(m.target);
      }
    });
    const start = () => { walk(document.body); obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    document.documentElement.lang = locale.slice(0, 2);
  }

  window.I18N = {
    lang, locale, LANGS, months: lang === 'en' ? null : months,
    t: (s) => tr(s) ?? s,
    set(l) { try { localStorage.setItem('rj-lang', l); } catch { /* bỏ qua */ } location.reload(); },
  };
})();
