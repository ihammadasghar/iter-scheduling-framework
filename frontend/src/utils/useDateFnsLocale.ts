import { pt } from 'date-fns/locale/pt';
import type { Locale } from 'date-fns';
import { useAppSelector } from '@/store/hooks';

// date-fns has no bundled 'en' locale object to pass explicitly — its
// default (undefined) behavior already matches this app's English
// rendering, so only pt-PT needs a mapped Locale object. `pt` (not `pt-BR`)
// is European Portuguese.
export const useDateFnsLocale = (): Locale | undefined => {
  const locale = useAppSelector((s) => s.language.locale);
  return locale === 'pt-PT' ? pt : undefined;
};
