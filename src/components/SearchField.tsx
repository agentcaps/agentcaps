import { SearchBox } from '@agentcaps/ui';
import { query } from '../state/search';

interface Props {
  placeholder?: string;
  autofocus?: boolean;
  class?: string;
}

/** Island: binds the design-system SearchBox to the shared query signal. */
export default function SearchField({ placeholder, autofocus, class: extra }: Props) {
  return (
    <SearchBox
      className={extra}
      autofocus={autofocus}
      placeholder={placeholder}
      value={query.value}
      onInput={(value) => (query.value = value)}
      onClear={() => (query.value = '')}
    />
  );
}
