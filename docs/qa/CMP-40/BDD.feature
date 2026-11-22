# Ngôn ngữ: tiếng Việt; tag là ID truy vết, không biểu thị đã chạy.
Feature: Xác minh sinh viên, phân quyền và đăng tin CMP-40
  @B01
  Scenario: Nộp minh chứng hợp lệ
    Given người dùng USER PENDING và ảnh thẻ giả JPG hoặc PNG
    When gửi school, studentCode, cardImage và các trường tùy chọn hợp lệ
    Then API tạo hồ sơ PENDING và UI cho biết đang chờ; không lộ ảnh hoặc URL trong trạng thái cá nhân
  @B02
  Scenario: Bảo mật và xác thực dữ liệu minh chứng
    Given người dùng chưa đăng nhập hoặc không phải ADMIN
    When gửi thiếu trường bắt buộc, ảnh sai loại hoặc truy cập minh chứng người khác
    Then API từ chối tương ứng; dữ liệu ảnh không bị tiết lộ
  @B03
  Scenario: Quyền PENDING
    Given người dùng PENDING đã đăng nhập
    When xem feed và gọi trực tiếp search, chi tiết và tương tác
    Then chỉ feed ACTIVE rút gọn được phép; các thao tác còn lại bị chặn phía server
  @B04
  Scenario Outline: Admin xét duyệt và audit
    Given hồ sơ PENDING và người xét duyệt có role ADMIN
    When admin chọn <decision> cùng lý do khi cần
    Then trạng thái là <decision>; audit có actor, đối tượng, quyết định, thời điểm và lý do áp dụng; người dùng nhận biết kết quả
    Examples:
      | decision |
      | APPROVED |
      | REJECTED |
  @B05
  Scenario: Phiên cũ sau thay đổi trạng thái
    Given JWT còn hạn được cấp trước khi trạng thái trong DB thay đổi
    When gọi trực tiếp API tạo tin sau approve rồi sau suspend
    Then guard dùng trạng thái DB hiện hành, cho phép APPROVED và chặn SUSPENDED
  @B06
  Scenario Outline: Quyền tạo tin
    Given caller là <caller>
    When gọi trực tiếp POST posts với dữ liệu <type> hợp lệ
    Then kết quả tương ứng quyền hiện hành và tin hợp lệ có trạng thái ACTIVE
    Examples:
      | caller   | type        |
      | guest    | SELL        |
      | PENDING  | BUY_REQUEST |
      | APPROVED | SELL        |
      | ADMIN    | BUY_REQUEST |
  @B07
  Scenario: Validation và xem lại tin
    Given người dùng có quyền tạo tin
    When tạo SELL hoặc BUY_REQUEST với trường thiếu, biên số, ảnh hoặc danh mục sai rồi với dữ liệu hợp lệ
    Then dữ liệu sai bị từ chối; tin hợp lệ lưu đúng loại, ACTIVE và xem lại được
  @B08
  Scenario: Health khi DB không kết nối
    Given DB test cô lập không thể kết nối
    When gọi GET health
    Then trả HTTP 200, degraded/disconnected và thông báo chung; response không lộ cấu hình, user DB, lỗi driver hay stack; log lọc thông tin nhạy cảm
  @B09
  Scenario: Phân biệt hai lỗi OTP HTTP 429
    Given OTP chưa hợp lệ
    When UI nhận OTP_ATTEMPTS_EXCEEDED hoặc OTP_RATE_LIMITED cùng HTTP 429
    Then phân biệt theo error.code, hướng dẫn tương ứng yêu cầu mã mới khi được phép hoặc chờ và không mở bước mật khẩu
  @B10
  Scenario: Kiểm tra schema lỗi
    Given schema ErrorEnvelope của OpenAPI
    When validate details item hợp lệ và item có thuộc tính thừa
    Then item chứa field và message được chấp nhận và item có thêm extra bị từ chối
  @B11
  Scenario: Ticket OTP chỉ dùng một lần
    Given OTP ticket đã verify và chưa dùng trên DB test cô lập
    When đăng ký một lần rồi replay hoặc gửi các request cạnh tranh
    Then tối đa một đăng ký thành công, chỉ một user và một phiên thành công; ticket đã consume không dùng lại
  @B12
  Scenario: OTP hết hạn và gửi lại
    Given cấu hình TTL, ngưỡng và cooldown đã biết trên môi trường cô lập
    When thử tại biên hết hạn, sai liên tiếp, resend và thử mã cũ
    Then mã hết hạn/mã cũ bị từ chối, giới hạn được áp dụng và mã mới hợp lệ hoạt động

  @B13
  Scenario: Phản hồi OTP thiếu retry metadata hoặc có mã lạ
    Given người dùng đang ở bước xác thực OTP
    When nhận rate limit không có retry metadata hoặc lỗi không nhận diện
    Then hiển thị hướng dẫn chung phù hợp, không tự đặt thời gian và giữ bước mật khẩu đóng
  @B14
  Scenario: Chỉ chuyển bước khi verify thành công
    Given người dùng đang ở bước xác thực OTP
    When verify thành công và nhận ticket hợp lệ
    Then UI cho phép mở bước tạo mật khẩu
  @B15
  Scenario: Kiểm thử SMTP có cấp phép
    Given hộp thư và SMTP test đã được cấp phép
    When gửi và nhận OTP trong môi trường thử nghiệm
    Then luồng gửi nhận được xác minh mà không lưu OTP hay dữ liệu nhạy cảm
