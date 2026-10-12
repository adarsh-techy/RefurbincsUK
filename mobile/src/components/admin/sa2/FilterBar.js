import { Text, TouchableOpacity, View } from 'react-native';
import DateField from '../DateField';
import { SearchBox } from './ui';

// The web list pages' filter bar: "Search driver / truck" + a date input +
// "Clear all" (shown once either is set).
export function FilterBar({ search, onSearch, searchLabel, placeholder = 'e.g. John or TRK-102', dateLabel, date, onDate }) {
  return (
    <View className="gap-2.5 rounded-xl border border-blue-200 bg-white p-3">
      <View>
        <Text className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">{searchLabel}</Text>
        <SearchBox value={search} onChangeText={onSearch} placeholder={placeholder} />
      </View>
      <DateField label={dateLabel} value={date} onChange={onDate} />
      {search || date ? (
        <TouchableOpacity onPress={() => { onSearch(''); onDate(''); }} className="self-start">
          <Text className="text-xs font-bold text-rose-600">Clear all</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
