import { CSXText } from '@/components/sx/core/CSXText'

export function MobileDetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #27272a' }}>
      <CSXText variant="body2" color="STSecondary">{label}</CSXText>
      <CSXText variant="body1" color={valueColor ?? 'STWhite'}>{value}</CSXText>
    </div>
  )
}
