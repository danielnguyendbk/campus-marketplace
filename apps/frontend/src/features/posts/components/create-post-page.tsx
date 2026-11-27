'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ApiError } from '../../../services/api';
import { authApi, type AuthApi } from '../../auth/api';
import { canPublishMarketplacePosts } from '../../auth/types';
import { useSession } from '../../auth/use-session';
import { marketplaceError } from '../../marketplace/api';
import { MarketplaceShell } from '../../marketplace/components/marketplace-shell';
import type { CreatePostInput, PostCategory, PostDetail } from '../types';
import styles from './create-post.module.css';
import { ProvinceSelect } from './province-select';

const postTypes = [
  { value: 'SELL', label: 'Đăng bán', hint: 'Bán món đồ bạn đang có' },
  { value: 'BUY_REQUEST', label: 'Tìm mua', hint: 'Đăng nhu cầu mua món đồ bạn cần' },
] as const;

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImages = 5;
const maxImageBytes = 10 * 1024 * 1024;
const titleLimit = 255;
const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 2,
});

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
type AmountName = 'price' | 'budgetMin' | 'budgetMax';
type FieldErrors = Partial<Record<FieldName, string>>;
type PostImage = { id: number; file: File };
type CategoryLoad =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: PostCategory[] };

function fieldValue(fields: FormData, name: FieldName) {
  return String(fields.get(name) ?? '').trim();
}

function parseAmount(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  return /^\d+(?:\.\d*)?$/.test(normalized) ? Number(normalized) : NaN;
}

function formatAmountInput(input: HTMLInputElement) {
  const original = input.value;
  const raw = original.replace(/[.\s]/g, '');
  if (!/^\d*(?:,\d*)?$/.test(raw)) return false;

  const [whole, fraction] = raw.split(',');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = fraction === undefined ? grouped : `${grouped || '0'},${fraction}`;
  if (formatted === original) return true;

  // Match the cursor to the digits after it so that inserting a separator does not move it.
  let digitsAfter = original
    .slice(input.selectionStart ?? original.length)
    .replace(/[.\s]/g, '').length;
  let cursor = formatted.length;
  while (cursor > 0 && digitsAfter > 0) {
    cursor -= 1;
    if (formatted[cursor] !== '.') digitsAfter -= 1;
  }
  input.value = formatted;
  input.setSelectionRange(cursor, cursor);
  return true;
}

function skipGroupingSeparator(event: React.KeyboardEvent<HTMLInputElement>) {
  const { selectionStart, selectionEnd, value } = event.currentTarget;
  if (selectionStart === null || selectionStart !== selectionEnd) return;
  if (event.key === 'Backspace' && value[selectionStart - 1] === '.') {
    event.currentTarget.setSelectionRange(selectionStart - 1, selectionStart - 1);
  } else if (event.key === 'Delete' && value[selectionStart] === '.') {
    event.currentTarget.setSelectionRange(selectionStart + 1, selectionStart + 1);
  }
}

function validate(
  fields: FormData,
  postType: PostType,
  imageCount: number,
  categories: PostCategory[],
) {
  const value = (name: FieldName) => fieldValue(fields, name);
  const number = (name: AmountName) => parseAmount(value(name));
  const errors: FieldErrors = {};

  if (!value('title')) errors.title = 'Nhập tiêu đề tin đăng.';
  else if (value('title').length > titleLimit) errors.title = 'Tiêu đề tối đa 255 ký tự.';
  if (!categories.some(({ id }) => id === value('categoryId')))
    errors.categoryId = 'Chọn một danh mục.';
  if (!value('province')) errors.province = 'Chọn tỉnh hoặc thành phố.';
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
      price: parseAmount(fieldValue(fields, 'price')),
      condition: fieldValue(fields, 'condition'),
      allowPhoneReveal: fields.has('allowPhoneReveal'),
    };
  }
  return {
    ...common,
    postType,
    budgetMin: parseAmount(fieldValue(fields, 'budgetMin')),
    budgetMax: parseAmount(fieldValue(fields, 'budgetMax')),
  };
}

function FieldError({ name, errors }: { name: FieldName; errors: FieldErrors }) {
  return errors[name] ? (
    <p className={styles.fieldError} id={`${name}-error`}>
      {errors[name]}
    </p>
  ) : null;
}

function RequiredMark() {
  return <span className={styles.requiredMark} aria-hidden="true" />;
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
  const [province, setProvince] = useState('');
  const [price, setPrice] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [images, setImages] = useState<PostImage[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showErrorSummary, setShowErrorSummary] = useState(false);
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
  const touchedFields = useRef(new Set<FieldName>());
  const nextImageId = useRef(0);
  const isSell = postType === 'SELL';
  const invalidFields = Object.entries(errors);
  const availableCategories = categories.kind === 'ready' ? categories.data : [];
  const categoryHintId = availableCategories.length ? undefined : 'post-categories-status';
  const minimum = parseAmount(budgetMin);
  const maximum = parseAmount(budgetMax);
  const validBudget =
    Number.isFinite(minimum) && Number.isFinite(maximum) && minimum >= 0 && maximum >= minimum;

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

  function updateErrors(issues: FieldErrors, ...names: FieldName[]) {
    setErrors((current) => {
      const next = { ...current };
      for (const name of names) {
        const message = issues[name];
        if (message) next[name] = message;
        else delete next[name];
      }
      return next;
    });
  }

  function validateFields(form: HTMLFormElement, names: FieldName[], imageCount = images.length) {
    updateErrors(validate(new FormData(form), postType, imageCount, availableCategories), ...names);
  }

  function touchField(name: FieldName, form: HTMLFormElement | null) {
    if (submitting || !form || touchedFields.current.has(name)) return;
    touchedFields.current.add(name);
    validateFields(form, [name]);
  }

  function field(
    name: FieldName,
    hintId?: string,
    updateValue?: (value: string) => void,
    groupAmount = false,
  ) {
    return {
      id: name,
      name,
      disabled: submitting,
      'aria-invalid': Boolean(errors[name]),
      'aria-describedby':
        [hintId, errors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined,
      onBlur: (
        event: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
      ) => touchField(name, event.currentTarget.form),
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
      ) => {
        const input = event.currentTarget;
        if (groupAmount && input instanceof HTMLInputElement && !formatAmountInput(input)) return;
        const { value, form } = input;
        updateValue?.(value);
        if (!denied) setSubmitError('');
        if (!value.trim()) touchedFields.current.add(name);
        const names = touchedFields.current.has(name) ? [name] : [];
        if (name === 'budgetMin' && touchedFields.current.has('budgetMax')) names.push('budgetMax');
        if (form && names.length) validateFields(form, names);
      },
    };
  }

  function amountField(name: AmountName, value: string, updateValue: (value: string) => void) {
    return {
      ...field(name, undefined, updateValue, true),
      value,
      inputMode: 'decimal' as const,
      lang: 'vi',
      onKeyDown: skipGroupingSeparator,
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

    const { form } = event.currentTarget;
    if (!denied) setSubmitError('');
    touchedFields.current.add('images');
    if (form) validateFields(form, ['images'], images.length + accepted.length);
    setImages((current) => [...current, ...accepted]);
    setImageNotice([...notices].join(' '));
  }

  function removeImage(id: number) {
    const remaining = images.filter((image) => image.id !== id);
    const form = imageInput.current?.form;
    if (!denied) setSubmitError('');
    if (form) validateFields(form, ['images'], remaining.length);
    setImages(remaining);
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
    if (hasIssues) {
      setShowErrorSummary(true);
      for (const name of fieldNames) if (issues[name]) touchedFields.current.add(name);
      return;
    }

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
      setProvince('');
      setPrice('');
      setBudgetMin('');
      setBudgetMax('');
      setImages([]);
      setImageNotice('');
      setShowErrorSummary(false);
      touchedFields.current.clear();
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
          setShowErrorSummary(true);
          for (const name of fieldNames) if (fieldErrors[name]) touchedFields.current.add(name);
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
      {showErrorSummary && invalidFields.length > 0 && (
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

      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="post-information-title">
          <h2 id="post-information-title">Thông tin tin đăng</h2>
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
                      setPrice('');
                      setBudgetMin('');
                      setBudgetMax('');
                      if (!denied) setSubmitError('');
                      const typeFields = [
                        'price',
                        'condition',
                        'budgetMin',
                        'budgetMax',
                        'images',
                      ] as const;
                      for (const name of typeFields) touchedFields.current.delete(name);
                      updateErrors({}, ...typeFields);
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
          <div className={styles.field}>
            <label htmlFor="title">
              Tiêu đề
              <RequiredMark />
            </label>
            <input
              {...field('title', 'post-title-count', setTitle)}
              value={title}
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
              <label htmlFor="categoryId">
                Danh mục
                <RequiredMark />
              </label>
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
              <label id="province-label" htmlFor="province">
                Tỉnh / Thành phố
                <RequiredMark />
              </label>
              <ProvinceSelect
                id="province"
                value={province}
                disabled={submitting}
                invalid={Boolean(errors.province)}
                describedBy={errors.province ? 'province-error' : undefined}
                onChange={(value) => {
                  setProvince(value);
                  touchedFields.current.add('province');
                  if (!denied) setSubmitError('');
                  updateErrors({}, 'province');
                }}
                onLeave={(form) => touchField('province', form)}
              />
              <FieldError name="province" errors={errors} />
            </div>
          </div>

          {isSell ? (
            <fieldset className={styles.details} key="sell">
              <legend>Giá và tình trạng</legend>
              <div className={styles.pairedFields}>
                <div className={styles.field}>
                  <label htmlFor="price">
                    Giá bán (₫)
                    <RequiredMark />
                  </label>
                  <input
                    {...amountField('price', price, setPrice)}
                    placeholder="Ví dụ: 150.000"
                    required
                  />
                  <FieldError name="price" errors={errors} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="condition">
                    Tình trạng sản phẩm
                    <RequiredMark />
                  </label>
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
                  <label htmlFor="budgetMin">
                    Ngân sách từ (₫)
                    <RequiredMark />
                  </label>
                  <input {...amountField('budgetMin', budgetMin, setBudgetMin)} required />
                  <FieldError name="budgetMin" errors={errors} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="budgetMax">
                    Ngân sách đến (₫)
                    <RequiredMark />
                  </label>
                  <input {...amountField('budgetMax', budgetMax, setBudgetMax)} required />
                  <FieldError name="budgetMax" errors={errors} />
                </div>
              </div>
            </fieldset>
          )}
          <div className={`${styles.field} ${styles.descriptionField}`}>
            <label htmlFor="description">
              Mô tả
              <RequiredMark />
            </label>
            <textarea {...field('description')} rows={4} required />
            <FieldError name="description" errors={errors} />
          </div>
        </section>

        <div className={styles.formAside}>
          {!isSell && (
            <section className={styles.card} aria-labelledby="buy-preview-title">
              <h2 id="buy-preview-title">Xem trước nhu cầu</h2>
              <div className={styles.buyPreview}>
                <span className={styles.buyLabel}>Tìm mua</span>
                <p className={styles.previewTitle}>{title.trim() || 'Tiêu đề tin của bạn'}</p>
                {validBudget ? (
                  <p className={styles.previewBudget}>
                    {currency.format(minimum)} – {currency.format(maximum)}
                  </p>
                ) : (
                  <p className={styles.previewHint}>Nhập khoảng ngân sách hợp lệ để xem trước.</p>
                )}
                {province.trim() && <p className={styles.previewHint}>{province.trim()}</p>}
              </div>
            </section>
          )}

          <section
            className={`${styles.card} ${styles.images}`}
            aria-labelledby="post-images-title"
          >
            <h2 id="post-images-title">
              {isSell ? 'Ảnh sản phẩm' : 'Ảnh tham khảo'}
              {isSell && <RequiredMark />}
            </h2>
            <label
              className={styles.imagePicker}
              data-invalid={Boolean(errors.images || imageNotice)}
            >
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
                onBlur={(event) => touchField('images', event.currentTarget.form)}
                onChange={pickImages}
              />
              <span aria-hidden="true">+</span>
              <span id="post-image-picker-label">Chọn ảnh</span>
            </label>
            <p id="post-images-hint" className={styles.imageHint}>
              {isSell ? 'Thêm từ 1 đến 5 ảnh.' : 'Không bắt buộc. Tối đa 5 ảnh.'} JPEG, PNG hoặc
              WebP · 10 MiB mỗi ảnh.
            </p>
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
        </div>
      </div>
    </form>
  );
}

export function CreatePostPage({ client = authApi }: { client?: AuthApi }) {
  const session = useSession(client);
  const status = session?.user.verificationStatus;
  const isAdmin = session?.user.role === 'ADMIN';

  return (
    <MarketplaceShell client={client}>
      <div className={styles.page}>
        <Link className={styles.backLink} href="/">
          <span aria-hidden="true">‹</span> Trang chủ
        </Link>
        <h1 className={styles.heading}>Đăng tin</h1>
        {canPublishMarketplacePosts(session?.user) ? (
          <CreatePostForm client={client} />
        ) : isAdmin ? (
          <section className={styles.card} aria-labelledby="posting-access-title">
            <h2 id="posting-access-title">Đăng tin dành cho sinh viên đã xác thực</h2>
            <p>Bạn có thể lướt và xem chi tiết các tin hiện có trên Marketplace.</p>
            <Link className={styles.backLink} href="/">
              Xem Marketplace
            </Link>
          </section>
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
