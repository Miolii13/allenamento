import { useEffect, useRef, useState } from 'react';
import { parseNum } from '../lib/format';

const toText = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));

interface Props {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  integer?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/** Campo numerico che accetta la virgola e non perde il cursore mentre scrivi "4,5". */
export function NumInput({ value, onChange, placeholder, integer, className, id, ...rest }: Props) {
  const [text, setText] = useState(toText(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(toText(value));
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      className={className}
      value={text}
      placeholder={placeholder}
      aria-label={rest['aria-label']}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(toText(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseNum(e.target.value);
        onChange(n === undefined ? undefined : integer ? Math.round(n) : n);
      }}
    />
  );
}
