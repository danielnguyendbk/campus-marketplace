'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { useSession } from '../../auth/use-session';
import { marketplaceError } from '../../marketplace/api';
import { MarketplaceShell } from '../../marketplace/components/marketplace-shell';
import type { CreatePostInput, PostCategory, PostDetail } from '../types';
import styles from './create-post.module.css';

const postTypes = [
  { value: 'SELL', label: 'Đăng bán', hint: 'Bán món đồ bạn đang có' },
  { value: 'BUY_REQUEST', label: 'Tìm mua', hint: 'Đăng nhu cầu mua món đồ bạn cần' },
] as const;

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImages = 5;
const maxImageBytes = 10 * 1024 * 1024;
const titleLimit = 255;

type PostType = CreatePostInput['postType'];
const fieldNames = [
  'title',
  'categoryId',
  'province',
  'description',
  'price',
  'condition',
  'budgetMin',
  'budgetMax',
  'images',
] as const;
type FieldName = (typeof fieldNames)[number];
type FieldErrors = Partial<Record<FieldName, string>>;
type PostImage = { id: number; file: File };
type CategoryLoad =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: PostCategory[] };

function fieldValue(fields: FormData, name: FieldName) {
  return String(fields.get(name) ?? '').trim();
}

function validate(
  fields: FormData,
  postType: PostType,
  imageCount: number,
  categories: PostCategory[],
) {
  const value = (name: FieldName) => fieldValue(fields, name);
  const number = (name: FieldName) => (value(name) ? Number(value(name)) : NaN);
  const errors: FieldErrors = {};

  if (!value('title')) errors.title = 'Nhập tiêu đề tin đăng.';
  else if (value('title').length > titleLimit) errors.title = 'Tiêu đề tối đa 255 ký tự.';
  if (!categories.some(({ id }) => id === value('categoryId')))
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

function postInput(fields: FormData, postType: PostType, images: File[]): CreatePostInput {
  const common = {
    title: fieldValue(fields, 'title'),
    categoryId: fieldValue(fields, 'categoryId'),
    description: fieldValue(fields, 'description'),
    province: fieldValue(fields, 'province'),
    images,
  };
  if (postType === 'SELL') {
    return {
      ...common,
      postType,
      price: Number(fieldValue(fields, 'price')),
      condition: fieldValue(fields, 'condition'),
      allowPhoneReveal: fields.has('allowPhoneReveal'),
    };
  }
  return {
    ...common,
    postType,
    budgetMin: Number(fieldValue(fields, 'budgetMin')),
    budgetMax: Number(fieldValue(fields, 'budgetMax')),
  };
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

function CreatePostForm({ client }: { client: AuthApi }) {
  const [postType, setPostType] = useState<PostType>('SELL');
  const [title, setTitle] = useState('');
  const [images, setImages] = useState<PostImage[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [imageNotice, setImageNotice] = useState('');
  const [categories, setCategories] = useState<CategoryLoad>({ kind: 'loading' });
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [denied, setDenied] = useState(false);
  const [createdPost, setCreatedPost] = useState<PostDetail | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const errorSummary = useRef<HTMLElement>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const submitRequest = useRef<AbortController | null>(null);
  const focusErrors = useRef(false);
  const nextImageId = useRef(0);
  const isSell = postType === 'SELL';
  const invalidFields = Object.entries(errors);
  const availableCategories = categories.kind === 'ready' ? categories.data : [];
  const categoryHintId = availableCategories.length ? undefined : 'post-categories-status';

  useEffect(() => {
    const controller = new AbortController();
    void client.listPostCategories(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setCategories({ kind: 'ready', data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) client.clearSession();
        else setCategories({ kind: 'error' });
      },
    );
    return () => controller.abort();
  }, [categoryAttempt, client]);
  useEffect(() => () => submitRequest.current?.abort(), []);
  useEffect(() => {
    if (createdPost) successHeading.current?.focus();
  }, [createdPost]);
  useEffect(() => {
    if (!focusErrors.current) return;
    focusErrors.current = false;
    errorSummary.current?.focus();
  }, [errors]);

  function clearErrors(...names: FieldName[]) {
    if (!denied) setSubmitError('');
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
      disabled: submitting,
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

  function reloadCategories() {
    setCategories({ kind: 'loading' });
    setCategoryAttempt((value) => value + 1);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitRequest.current || !availableCategories.length || denied) return;
    const fields = new FormData(event.currentTarget);
    const issues = validate(fields, postType, images.length, availableCategories);
    const hasIssues = Object.keys(issues).length > 0;
    setSubmitError('');
    focusErrors.current = hasIssues;
    setErrors(issues);
    if (hasIssues) return;

    const controller = new AbortController();
    submitRequest.current = controller;
    setSubmitting(true);
    try {
      const result = await client.createPost(
        postInput(
          fields,
          postType,
          images.map(({ file }) => file),
        ),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setCreatedPost(result);
      setTitle('');
      setImages([]);
      setImageNotice('');
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) {
        client.clearSession();
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setDenied(true);
        setSubmitError(
          error.code === 'ACCOUNT_SUSPENDED'
            ? 'Tài khoản đang bị đình chỉ.'
            : 'Tài khoản hiện chưa đủ quyền đăng tin. Hãy kiểm tra trạng thái xác thực.',
        );
        return;
      }
      if (error instanceof ApiError && [400, 422].includes(error.status)) {
        const fieldErrors: FieldErrors = {};
        for (const issue of error.details ?? []) {
          const field = fieldNames.find((name) => name === issue.field);
          if (field && issue.message) fieldErrors[field] = issue.message;
        }
        if (Object.keys(fieldErrors).length) {
          focusErrors.current = true;
          setErrors(fieldErrors);
          return;
        }
      }
      const uncertain =
        !(error instanceof ApiError) ||
        error.status >= 500 ||
        (error.status >= 200 && error.status < 300);
      setSubmitError(
        uncertain
          ? 'Chưa xác nhận được kết quả đăng tin. Kiểm tra kết quả trước khi gửi lại.'
          : marketplaceError(error),
      );
    } finally {
      submitRequest.current = null;
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }

  if (createdPost) {
    return (
      <section className={styles.card} aria-labelledby="post-success-title">
        <h2 ref={successHeading} id="post-success-title" tabIndex={-1}>
          Đã đăng tin
        </h2>
        <p className={styles.successNotice}>{createdPost.title}</p>
        <div className={styles.successActions}>
          <Link className={styles.submit} href={`/posts/${createdPost.id}`}>
            Xem tin vừa đăng
          </Link>
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={() => setCreatedPost(null)}
          >
            Đăng tin khác
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-busy={submitting} noValidate>
      {invalidFields.length > 0 && (
        <section
          ref={errorSummary}
          className={styles.errorSummary}
          role="alert"
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

      <fieldset className={styles.typeSection} disabled={submitting}>
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
              <select
                {...field('categoryId', categoryHintId)}
                defaultValue=""
                disabled={submitting || availableCategories.length === 0}
                required
              >
                <option value="" disabled>
                  Chọn danh mục
                </option>
                {availableCategories.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <FieldError name="categoryId" errors={errors} />
              {categories.kind === 'loading' && (
                <p className={styles.hint} id="post-categories-status" role="status">
                  Đang tải danh mục…
                </p>
              )}
              {(categories.kind === 'error' ||
                (categories.kind === 'ready' && categories.data.length === 0)) && (
                <div className={styles.categoryNotice} id="post-categories-status">
                  <p role={categories.kind === 'error' ? 'alert' : 'status'}>
                    {categories.kind === 'error'
                      ? 'Không thể tải danh mục.'
                      : 'Chưa có danh mục đang hoạt động.'}
                  </p>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={reloadCategories}
                  >
                    Tải lại danh mục
                  </button>
                </div>
              )}
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
                  disabled={submitting}
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

        <section className={`${styles.card} ${styles.images}`} aria-labelledby="post-images-title">
          <h2 id="post-images-title">{isSell ? 'Ảnh sản phẩm' : 'Ảnh tham khảo'}</h2>
          <p id="post-images-hint" className={styles.hint}>
            {isSell ? 'Thêm từ 1 đến 5 ảnh.' : 'Không bắt buộc. Tối đa 5 ảnh.'} JPEG, PNG hoặc WebP
            · 10 MiB mỗi ảnh.
          </p>
          <label className={styles.imagePicker}>
            <input
              ref={imageInput}
              id="images"
              name="images"
              type="file"
              multiple
              disabled={submitting}
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
                    disabled={submitting}
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
        {submitError && (
          <p className={styles.fieldError} role="alert">
            {submitError}
          </p>
        )}
        {denied && (
          <Link className={styles.backLink} href="/verification">
            Xem hồ sơ xác thực
          </Link>
        )}
        <button
          className={styles.submit}
          type="submit"
          disabled={submitting || availableCategories.length === 0 || denied}
        >
          {submitting ? 'Đang đăng tin…' : isSell ? 'Đăng tin bán' : 'Đăng tin tìm mua'}
        </button>
      </div>
    </form>
  );
}

export function CreatePostPage({ client = authApi }: { client?: AuthApi }) {
  const session = useSession(client);
  const status = session?.user.verificationStatus;

  return (
    <MarketplaceShell client={client}>
      <div className={styles.page}>
        <Link className={styles.backLink} href="/">
          <span aria-hidden="true">‹</span> Trang chủ
        </Link>
        <h1 className={styles.heading}>Đăng tin</h1>
        {status === 'APPROVED' ? (
          <CreatePostForm client={client} />
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
