'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from '../../auth/use-session';
import { MarketplaceShell } from '../../marketplace/components/marketplace-shell';
import styles from './create-post.module.css';

const postTypes = [
  { value: 'SELL', label: 'Đăng bán', hint: 'Bán món đồ bạn đang có' },
  { value: 'BUY_REQUEST', label: 'Tìm mua', hint: 'Đăng nhu cầu mua món đồ bạn cần' },
] as const;

const sampleCategories = [
  ['TEXTBOOK', 'Sách và giáo trình'],
  ['ELECTRONICS', 'Thiết bị điện tử & phụ kiện'],
  ['FURNITURE', 'Nội thất & đồ dùng phòng trọ'],
  ['APPLIANCES', 'Đồ gia dụng sinh viên'],
  ['OTHER', 'Đồ dùng khác'],
] as const;

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImages = 5;
const maxImageBytes = 10 * 1024 * 1024;
const titleLimit = 255;

type PostType = (typeof postTypes)[number]['value'];
type FieldName =
  | 'title'
  | 'categoryId'
  | 'province'
  | 'description'
  | 'price'
  | 'condition'
  | 'budgetMin'
  | 'budgetMax'
  | 'images';
type FieldErrors = Partial<Record<FieldName, string>>;
type PostImage = { id: number; file: File };

function validate(form: HTMLFormElement, postType: PostType, imageCount: number) {
  const fields = new FormData(form);
  const value = (name: FieldName) => String(fields.get(name) ?? '').trim();
  const number = (name: FieldName) => (value(name) ? Number(value(name)) : NaN);
  const errors: FieldErrors = {};

  if (!value('title')) errors.title = 'Nhập tiêu đề tin đăng.';
  else if (value('title').length > titleLimit) errors.title = 'Tiêu đề tối đa 255 ký tự.';
  if (!sampleCategories.some(([id]) => id === value('categoryId')))
    errors.categoryId = 'Chọn một danh mục.';
  if (!value('province')) errors.province = 'Nhập tỉnh hoặc thành phố.';
  if (!value('description')) errors.description = 'Nhập mô tả tin đăng.';

  if (postType === 'SELL') {
    const price = number('price');
    if (!Number.isFinite(price) || price < 0.01) errors.price = 'Nhập giá bán từ 0,01 ₫.';
    if (!value('condition')) errors.condition = 'Nhập tình trạng sản phẩm.';
    if (imageCount === 0) errors.images = 'Thêm ít nhất một ảnh sản phẩm.';
  } else {
    const min = number('budgetMin');
    const max = number('budgetMax');
    if (!Number.isFinite(min) || min < 0) errors.budgetMin = 'Nhập mức ngân sách từ 0 ₫.';
    if (!Number.isFinite(max) || max < 0) errors.budgetMax = 'Nhập mức ngân sách đến từ 0 ₫.';
    else if (!errors.budgetMin && max < min)
      errors.budgetMax = 'Mức ngân sách đến phải bằng hoặc cao hơn mức bắt đầu.';
  }

  return errors;
}

function FieldError({ name, errors }: { name: FieldName; errors: FieldErrors }) {
  return errors[name] ? (
    <p className={styles.fieldError} id={`${name}-error`}>
      {errors[name]}
    </p>
  ) : null;
}

function ImagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url ? <Image src={url} width={148} height={100} alt="" unoptimized /> : null;
}

function CreatePostForm() {
  const [postType, setPostType] = useState<PostType>('SELL');
  const [title, setTitle] = useState('');
  const [images, setImages] = useState<PostImage[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [imageNotice, setImageNotice] = useState('');
  const [validated, setValidated] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const errorSummary = useRef<HTMLElement>(null);
  const focusErrors = useRef(false);
  const nextImageId = useRef(0);
  const isSell = postType === 'SELL';
  const invalidFields = Object.entries(errors);

  useEffect(() => {
    if (!focusErrors.current) return;
    focusErrors.current = false;
    errorSummary.current?.focus();
  }, [errors]);

  function clearErrors(...names: FieldName[]) {
    setValidated(false);
    setErrors((current) => {
      const remaining = { ...current };
      for (const name of names) delete remaining[name];
      return remaining;
    });
  }

  function field(name: FieldName, hintId?: string) {
    return {
      id: name,
      name,
      'aria-invalid': Boolean(errors[name]),
      'aria-describedby':
        [hintId, errors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined,
      onChange: () => clearErrors(name, ...(name === 'budgetMin' ? (['budgetMax'] as const) : [])),
    };
  }

  function pickImages(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!picked.length) return;

    const accepted: PostImage[] = [];
    const notices = new Set<string>();
    for (const file of picked) {
      if (!imageTypes.includes(file.type.toLowerCase()))
        notices.add('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
      else if (file.size === 0) notices.add('Ảnh trống. Hãy chọn một tệp khác.');
      else if (file.size > maxImageBytes) notices.add('Mỗi ảnh tối đa 10 MiB.');
      else if (images.length + accepted.length >= maxImages) notices.add('Mỗi tin tối đa 5 ảnh.');
      else accepted.push({ id: nextImageId.current++, file });
    }

    clearErrors('images');
    setImages((current) => [...current, ...accepted]);
    setImageNotice([...notices].join(' '));
  }

  function removeImage(id: number) {
    clearErrors('images');
    setImages((current) => current.filter((image) => image.id !== id));
    setImageNotice('');
    imageInput.current?.focus();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = validate(event.currentTarget, postType, images.length);
    focusErrors.current = Object.keys(issues).length > 0;
    setErrors(issues);
    setValidated(!focusErrors.current);
  }

  return (
    <>
      <p className={styles.previewNotice} id="post-preview-note">
        <strong>Bản xem trước.</strong> Danh mục mẫu, nút kiểm tra chỉ xác thực dữ liệu trên màn
        hình.
      </p>
      <form
        className={styles.form}
        onSubmit={submit}
        aria-describedby="post-preview-note"
        noValidate
      >
        {invalidFields.length > 0 && (
          <section
            ref={errorSummary}
            className={styles.errorSummary}
            tabIndex={-1}
            aria-labelledby="post-validation-title"
          >
            <h2 id="post-validation-title">Kiểm tra lại thông tin</h2>
            <ul>
              {invalidFields.map(([name, message]) => (
                <li key={name}>
                  <a href={`#${name}`}>{message}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <fieldset className={styles.typeSection}>
          <legend>Loại tin</legend>
          <div className={styles.typeOptions}>
            {postTypes.map((type) => (
              <label key={type.value} className={styles.typeOption}>
                <input
                  type="radio"
                  name="postType"
                  value={type.value}
                  checked={postType === type.value}
                  onChange={() => {
                    setPostType(type.value);
                    clearErrors('price', 'condition', 'budgetMin', 'budgetMax', 'images');
                  }}
                />
                <span>
                  <strong>{type.label}</strong>
                  <small>{type.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.columns}>
          <section className={styles.card} aria-labelledby="post-information-title">
            <h2 id="post-information-title">Thông tin tin đăng</h2>
            <div className={styles.field}>
              <label htmlFor="title">Tiêu đề</label>
              <input
                {...field('title', 'post-title-count')}
                value={title}
                onChange={(event) => {
                  setTitle(event.currentTarget.value);
                  clearErrors('title');
                }}
                maxLength={titleLimit}
                required
              />
              <span className={styles.counter} id="post-title-count">
                {title.length}/{titleLimit} ký tự
              </span>
              <FieldError name="title" errors={errors} />
            </div>
            <div className={styles.pairedFields}>
              <div className={styles.field}>
                <label htmlFor="categoryId">Danh mục</label>
                <select {...field('categoryId')} defaultValue="" required>
                  <option value="" disabled>
                    Chọn danh mục
                  </option>
                  {sampleCategories.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <FieldError name="categoryId" errors={errors} />
              </div>
              <div className={styles.field}>
                <label htmlFor="province">Tỉnh / Thành phố</label>
                <input {...field('province')} maxLength={100} required />
                <FieldError name="province" errors={errors} />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="description">Mô tả</label>
              <textarea {...field('description')} rows={4} required />
              <FieldError name="description" errors={errors} />
            </div>

            {isSell ? (
              <fieldset className={styles.details} key="sell">
                <legend>Giá và tình trạng</legend>
                <div className={styles.pairedFields}>
                  <div className={styles.field}>
                    <label htmlFor="price">Giá bán (₫)</label>
                    <input
                      {...field('price')}
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="any"
                      required
                    />
                    <FieldError name="price" errors={errors} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="condition">Tình trạng sản phẩm</label>
                    <input {...field('condition')} maxLength={255} required />
                    <FieldError name="condition" errors={errors} />
                  </div>
                </div>
                <label className={styles.phoneOption}>
                  <input
                    type="checkbox"
                    name="allowPhoneReveal"
                    defaultChecked
                    onChange={() => setValidated(false)}
                  />
                  Cho phép yêu cầu xem số điện thoại
                </label>
              </fieldset>
            ) : (
              <fieldset className={styles.details} key="buy">
                <legend>Khoảng ngân sách</legend>
                <div className={styles.pairedFields}>
                  <div className={styles.field}>
                    <label htmlFor="budgetMin">Ngân sách từ (₫)</label>
                    <input
                      {...field('budgetMin')}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      required
                    />
                    <FieldError name="budgetMin" errors={errors} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="budgetMax">Ngân sách đến (₫)</label>
                    <input
                      {...field('budgetMax')}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      required
                    />
                    <FieldError name="budgetMax" errors={errors} />
                  </div>
                </div>
              </fieldset>
            )}
          </section>

          <section
            className={`${styles.card} ${styles.images}`}
            aria-labelledby="post-images-title"
          >
            <h2 id="post-images-title">{isSell ? 'Ảnh sản phẩm' : 'Ảnh tham khảo'}</h2>
            <p id="post-images-hint" className={styles.hint}>
              {isSell ? 'Thêm từ 1 đến 5 ảnh.' : 'Không bắt buộc. Tối đa 5 ảnh.'} JPEG, PNG hoặc
              WebP · 10 MiB mỗi ảnh.
            </p>
            <label className={styles.imagePicker}>
              <input
                ref={imageInput}
                id="images"
                name="images"
                type="file"
                multiple
                accept={imageTypes.join(',')}
                aria-labelledby="post-image-picker-label"
                aria-invalid={Boolean(errors.images || imageNotice)}
                aria-describedby={[
                  'post-images-hint',
                  errors.images && 'images-error',
                  imageNotice && 'post-image-notice',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onChange={pickImages}
              />
              <span aria-hidden="true">+</span>
              <span id="post-image-picker-label">Chọn ảnh</span>
            </label>
            <p className={styles.imageCount} role="status">
              {images.length}/{maxImages} ảnh
            </p>
            <FieldError name="images" errors={errors} />
            {imageNotice && (
              <p id="post-image-notice" className={styles.fieldError} role="alert">
                {imageNotice}
              </p>
            )}
            {images.length > 0 && (
              <ul className={styles.imageList}>
                {images.map(({ id, file }) => (
                  <li key={id} className={styles.imageTile}>
                    <ImagePreview file={file} />
                    <span className={styles.filename} title={file.name}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Bỏ ảnh ${file.name}`}
                      onClick={() => removeImage(id)}
                    >
                      Bỏ ảnh
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className={styles.actions}>
          {validated && (
            <p className={styles.validNotice} role="status">
              Thông tin hợp lệ. Tin chưa được đăng.
            </p>
          )}
          <button className={styles.submit} type="submit">
            Kiểm tra thông tin
          </button>
        </div>
      </form>
    </>
  );
}

export function CreatePostPage() {
  const session = useSession();
  const status = session?.user.verificationStatus;

  return (
    <MarketplaceShell>
      <div className={styles.page}>
        <Link className={styles.backLink} href="/">
          <span aria-hidden="true">‹</span> Trang chủ
        </Link>
        <h1 className={styles.heading}>Đăng tin</h1>
        {status === 'APPROVED' ? (
          <CreatePostForm />
        ) : (
          <section className={styles.card} aria-labelledby="posting-access-title">
            <h2 id="posting-access-title">
              {status === 'SUSPENDED' ? 'Tài khoản bị đình chỉ' : 'Cần xác thực sinh viên'}
            </h2>
            {status === 'SUSPENDED' ? (
              <p>Tài khoản đang bị đình chỉ nên chưa thể đăng tin.</p>
            ) : (
              <>
                <p>
                  {status === 'REJECTED'
                    ? 'Cập nhật hồ sơ để được xét duyệt lại.'
                    : 'Bạn có thể đăng tin sau khi hồ sơ được duyệt.'}
                </p>
                <Link className={styles.backLink} href="/verification">
                  {status === 'REJECTED' ? 'Cập nhật hồ sơ' : 'Xem hồ sơ xác thực'}
                </Link>
              </>
            )}
          </section>
        )}
      </div>
    </MarketplaceShell>
  );
}
