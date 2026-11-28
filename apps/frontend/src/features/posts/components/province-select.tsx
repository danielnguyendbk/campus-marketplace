'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './create-post.module.css';

// Provincial names from Resolution 202/2025/QH15, with the three priority cities first.
const vietnameseOrder = new Intl.Collator('vi');
const provinces = [
  'Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  ...[
    'An Giang',
    'Bắc Ninh',
    'Cà Mau',
    'Cao Bằng',
    'Cần Thơ',
    'Đắk Lắk',
    'Điện Biên',
    'Đồng Nai',
    'Đồng Tháp',
    'Gia Lai',
    'Hà Tĩnh',
    'Hải Phòng',
    'Huế',
    'Hưng Yên',
    'Khánh Hòa',
    'Lai Châu',
    'Lâm Đồng',
    'Lạng Sơn',
    'Lào Cai',
    'Nghệ An',
    'Ninh Bình',
    'Phú Thọ',
    'Quảng Ngãi',
    'Quảng Ninh',
    'Quảng Trị',
    'Sơn La',
    'Tây Ninh',
    'Thái Nguyên',
    'Thanh Hóa',
    'Tuyên Quang',
    'Vĩnh Long',
  ].sort(vietnameseOrder.compare),
];

function searchableName(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
    .replace(/\s+/g, ' ');
}

export function ProvinceSelect({
  id,
  value,
  disabled,
  invalid,
  required = true,
  describedBy,
  onChange,
  onLeave,
}: {
  id: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
  required?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
  onLeave?: (form: HTMLFormElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const popupId = `${id}-popup`;
  const listId = `${id}-list`;
  const term = searchableName(query);
  const options = provinces.filter((province) => searchableName(province).includes(term));
  const activeId = options[activeIndex] ? `${listId}-${activeIndex}` : undefined;

  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeId, query]);

  useEffect(() => {
    if (!open) return;
    function handleOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      setOpen(false);
      onLeave?.(trigger.current?.form ?? null);
    }
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [open, onLeave]);

  function openList() {
    setQuery('');
    setActiveIndex(Math.max(0, provinces.indexOf(value)));
    setOpen(true);
  }

  function choose(province: string) {
    onChange(province);
    trigger.current?.focus();
    setOpen(false);
  }

  function searchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      trigger.current?.focus();
      setOpen(false);
      onLeave?.(trigger.current?.form ?? null);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const province = options[activeIndex];
      if (province) choose(province);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!options.length) return;
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (index + offset + options.length) % options.length);
    }
  }

  return (
    <div
      ref={root}
      className={styles.provinceSelect}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setOpen(false);
        onLeave?.(trigger.current?.form ?? null);
      }}
    >
      <input type="hidden" name={id} value={value} disabled={disabled} />
      {required && (
        <span id={`${id}-required`} hidden>
          Trường bắt buộc
        </span>
      )}
      <button
        ref={trigger}
        id={id}
        type="button"
        className={styles.provinceTrigger}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={
          [required && `${id}-required`, describedBy].filter(Boolean).join(' ') || undefined
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => {
          if (open) {
            setOpen(false);
            onLeave?.(trigger.current?.form ?? null);
          } else {
            openList();
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          openList();
        }}
      >
        <span id={`${id}-value`} data-placeholder={!value}>
          {value || 'Chọn địa phương'}
        </span>
        <span className={styles.provinceCaret} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={popupId}
          className={styles.provinceMenu}
          role="dialog"
          aria-label="Chọn tỉnh hoặc thành phố"
        >
          <input
            ref={search}
            type="search"
            role="combobox"
            aria-label="Tìm tỉnh hoặc thành phố"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            placeholder="Tìm tỉnh hoặc thành phố"
            value={query}
            onKeyDown={searchKeyDown}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveIndex(0);
            }}
          />
          <ul id={listId} className={styles.provinceOptions} role="listbox" aria-label="Địa phương">
            {options.map((province, index) => (
              <li
                key={province}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={province === value}
                data-active={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(province)}
              >
                {province}
              </li>
            ))}
          </ul>
          {!options.length && (
            <p className={styles.provinceEmpty} role="status">
              Không tìm thấy địa phương phù hợp.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
