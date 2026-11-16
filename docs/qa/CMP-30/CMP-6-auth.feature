# language: en
# Kết quả riêng từng hành vi/lớp: Test_Execution_Report.md (EX-01A…EX-19A).
# Mặc định và quy tắc triển khai ở README; @review là sai khác cần review, @dependency là phụ thuộc chưa triển khai.
Feature: CMP-6 Đăng ký email OTP và đăng nhập
  Các giá trị ký hiệu và quyết định còn mở được mô tả trong README.md.

  @required @BDD-01
  Scenario: Yêu cầu OTP cho email trường chưa tồn tại
    Given email E_NEW có domain được phép và chưa có tài khoản
    And hộp thư thử nghiệm của E_NEW nhận được thư
    When người dùng yêu cầu gửi OTP cho E_NEW
    Then hệ thống chấp nhận yêu cầu với thông điệp trung tính
    And một OTP được gửi tới hộp thư thử nghiệm
    And chưa có tài khoản hoặc phiên đăng nhập mới cho E_NEW

  @required @BDD-02
  Scenario: Từ chối domain ngoài allowlist
    Given email có định dạng hợp lệ và domain D_DENY ngoài allowlist
    When gọi API yêu cầu OTP bằng email đó
    Then backend từ chối yêu cầu
    And không tạo tài khoản hoặc phiên đăng nhập

  @required @BDD-03
  Scenario: Không tạo tài khoản trùng email
    Given E_EXIST đã có tài khoản và có ticket thử nghiệm đã xác thực cho E_EXIST
    When yêu cầu OTP rồi gửi đăng ký với ticket và thông tin hợp lệ
    Then yêu cầu OTP trả thông điệp trung tính
    And đăng ký bị từ chối và không tạo tài khoản thứ hai hoặc phiên mới

  @required @BDD-04
  Scenario: Xác thực OTP đúng trong thời hạn
    Given E_NEW đã nhận OTP_OK còn hiệu lực và chưa vượt giới hạn thử
    When gọi API xác thực E_NEW với OTP_OK
    Then backend trả ticket xác thực OTP
    And người dùng được chuyển đến bước tạo mật khẩu
    And chưa có phiên đăng nhập ở bước xác thực OTP

  @required @BDD-05
  Scenario: Từ chối OTP sai
    Given E_NEW có OTP còn hiệu lực và số lần sai dưới ngưỡng
    When gọi API xác thực E_NEW với OTP_BAD khác mã đã gửi
    Then backend từ chối xác thực và không trả ticket
    And yêu cầu đăng ký không có ticket hợp lệ không tạo tài khoản hoặc phiên

  @required @BDD-06
  Scenario: Từ chối OTP đã hết hạn
    Given OTP_OK của E_NEW đã hết hạn theo OTP_TTL
    When gọi API xác thực E_NEW với OTP_OK
    Then backend từ chối xác thực và không trả ticket
    And không tạo tài khoản hoặc phiên đăng nhập

  @required @BDD-07
  Scenario: Từ chối OTP sau khi vượt giới hạn thử
    Given OTP của E_NEW còn hiệu lực và đã chạm MAX_OTP_ATTEMPTS theo cấu hình môi trường test
    When gọi API xác thực E_NEW với OTP_OK
    Then backend từ chối xác thực và không trả ticket
    And không tạo tài khoản hoặc phiên đăng nhập

  @required @BDD-08
  Scenario: Không tạo mật khẩu trước khi xác thực OTP
    Given E_NEW chưa xác thực OTP thành công
    When người dùng bỏ qua giao diện và gửi đăng ký với ticket thiếu hoặc giả
    Then backend từ chối tạo tài khoản và mật khẩu
    And giao diện không mở bước tạo mật khẩu trước khi verify thành công

  @required @BDD-09
  Scenario: Không cấp phiên đăng ký trước khi xác thực OTP
    Given E_NEW chưa xác thực OTP và chưa có tài khoản
    When gửi đăng ký trực tiếp với ticket giả rồi thử đăng nhập E_NEW
    Then cả hai yêu cầu bị từ chối
    And không có access token hoặc tài khoản mới

  @required @BDD-10
  Scenario: Tạo tài khoản PENDING sau xác thực OTP
    Given E_NEW chưa có tài khoản và đã nhận ticket OTP hợp lệ
    When gửi đăng ký với ticket, tên hiển thị và mật khẩu hợp lệ
    Then hệ thống tạo một tài khoản với email từ ticket và trạng thái PENDING
    And trả phiên đăng nhập của tài khoản đó

  @required @BDD-11
  Scenario: Đăng nhập PENDING bằng thông tin hợp lệ
    Given tài khoản E_EXIST có trạng thái PENDING và mật khẩu hợp lệ đã biết
    When người dùng đăng nhập bằng E_EXIST và mật khẩu đó
    Then hệ thống trả phiên thuộc tài khoản E_EXIST với trạng thái PENDING

  @required @BDD-12
  Scenario Outline: Thông báo đăng nhập không hợp lệ
    Given tài khoản thử nghiệm E_EXIST đã được tạo
    When người dùng đăng nhập với <thong_tin>
    Then backend từ chối đăng nhập và không trả phiên
    And giao diện thông báo thông tin đăng nhập không hợp lệ
    Examples:
      | thong_tin                              |
      | E_EXIST và mật khẩu sai                |
      | email chưa tồn tại và mật khẩu bất kỳ  |

  @required @dependency @BDD-13
  Scenario: Xác định trạng thái và quyền sau đăng nhập
    Given có tài khoản USER PENDING và USER APPROVED cùng bài ACTIVE thử nghiệm
    When từng tài khoản đăng nhập và yêu cầu feed hoặc chi tiết bài
    Then phiên thể hiện đúng role và trạng thái của từng tài khoản
    And PENDING chỉ nhận feed giới hạn và bị từ chối chi tiết bài
    And APPROVED được truy cập chi tiết bài phù hợp quyền

  @required @dependency @BDD-14
  Scenario: Khách không truy cập chức năng yêu cầu xác thực
    Given người truy cập không có phiên đăng nhập
    When gọi GET /feed không có token
    Then backend trả 401 và không trả dữ liệu feed

  @proposed @BDD-15
  Scenario Outline: Kiểm tra email trống hoặc sai định dạng
    Given người truy cập đang ở bước nhập email đăng ký
    When gửi yêu cầu OTP với email <email>
    Then backend từ chối dữ liệu và không tạo tài khoản hoặc phiên
    Examples:
      | email              |
      | chuỗi rỗng         |
      | abc-khong-co-at    |

  @proposed @BDD-16
  Scenario: Kiểm tra mật khẩu không hợp lệ và xác nhận không khớp
    Given E_NEW đã xác thực OTP và có ticket hợp lệ
    When gửi đăng ký với mật khẩu 7 ký tự hoặc nhập xác nhận khác mật khẩu trên giao diện
    Then backend từ chối mật khẩu 7 ký tự
    And giao diện chặn gửi khi xác nhận không khớp
    And không tạo tài khoản hoặc phiên

  @proposed @review @BDD-17
  Scenario: Không dùng lại OTP và ticket đã dùng
    Given OTP_OK đã xác thực thành công và ticket đã dùng để tạo tài khoản E_NEW
    When xác thực lại OTP_OK rồi đăng ký lại bằng ticket đã dùng
    Then backend không trả ticket mới và không tạo thêm tài khoản hoặc phiên

  @proposed @BDD-18
  Scenario: Gửi lại OTP và thử mã thuộc email khác
    Given E_NEW đã yêu cầu OTP và E_OTHER có OTP_B khác mã của E_NEW
    When yêu cầu gửi lại cho E_NEW sau RESEND_WAIT rồi xác thực lần lượt OTP cũ và OTP_B với E_NEW
    Then backend từ chối OTP_B cho E_NEW và không trả ticket
    And OTP cũ chưa xác thực của E_NEW bị từ chối sau khi gửi lại thành công

  @proposed @BDD-19
  Scenario: Kiểm tra biên thời hạn và số lần thử
    Given truy vấn OTP hoạt động chọn expires_at lớn hơn thời điểm truy vấn và mỗi lần sai làm tăng attempts
    And môi trường có đồng hồ thử nghiệm kiểm soát được
    When xác thực OTP riêng ở ngay trước, đúng và ngay sau hạn và thử ở các mốc trước, tại, sau ngưỡng
    Then OTP đúng được chọn ngay trước hạn và không được chọn tại hoặc sau hạn
    And lần sai chạm MAX_OTP_ATTEMPTS bị từ chối theo giới hạn
    And OTP bị từ chối sau khi vượt giới hạn thử
