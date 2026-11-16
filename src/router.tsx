import { useEffect, useState, type AnchorHTMLAttributes } from 'react';

/** Router minimale basato sull'hash: funziona su qualsiasi hosting statico senza configurazione. */
function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

export function useRoute(): { path: string; parts: string[]; query: URLSearchParams } {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const [pathname, search = ''] = path.split('?');
  return { path: pathname, parts: pathname.split('/').filter(Boolean), query: new URLSearchParams(search) };
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) {
    window.history.replaceState(null, '', `#${to}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = to;
  }
}

export function Link({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a href={`#${to}`} {...rest} />;
}
