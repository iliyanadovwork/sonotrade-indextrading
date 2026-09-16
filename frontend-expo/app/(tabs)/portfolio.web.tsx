import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Pressable, Image, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { ENDPOINTS } from '@/constants/API';
import { Colors } from '@/constants/theme';
import { POSITIVE, NEGATIVE } from '@/constants/colors';
import { SharePositionSheet, type ShareData } from '@/components/SharePositionSheet.web';

interface Position {
  id: string;
  spotify_id?: string;
  artist_name: string;
  position_type: 'long' | 'short';
  contracts: number;
  entry_price: number;
  current_price: number;
  total_cost: number;
  market_value: number;
  unrealized_pnl: number;
  opened_at: string;
}

interface Order {
  id: string;
  artist_name: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit';
  price: number;
  quantity: number;
  filled_quantity: number;
  remaining_quantity: number;
  status: string;
  created_at: string;
}

interface ClosedPosition {
  id: string;
  artist_name: string;
  position_type: 'long' | 'short';
  contracts: number;
  entry_price: number;
  current_price: number;
  total_cost: number;
  unrealized_pnl: number;
  opened_at: string;
  closed_at: string;
  status: 'closed' | 'liquidated';
}

interface PortfolioData {
  balance: number;
  username: string;
  total_market_value: number;
  total_unrealized_pnl: number;
  positions: Position[];
  open_orders: Order[];
  order_history: Order[];
}

function DetailRow({ label, value, valueColor = '#fff' }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export default function PortfolioScreen() {
  const { token, logout, user, checkAuth } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: 'position' | 'order' | 'closed_position'; data: any } | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const summaryItemWidth = (width - 52) / 2;

  const fetchPortfolio = useCallback(async () => {
    if (!token) return;
    try {
      const [portfolioRes, historyRes] = await Promise.all([
        fetch(ENDPOINTS.PORTFOLIO, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(ENDPOINTS.TRADES.HISTORY, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (portfolioRes.ok) {
        const d = await portfolioRes.json();
        setData(d);
      }
      if (historyRes.ok) {
        const d = await historyRes.json();
        setClosedPositions(d.history || []);
      }
    } catch (e) {
      console.error('Portfolio fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 10000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  const handleAvatarPress = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(ENDPOINTS.AUTH.AVATAR, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (json.avatar_url) {
        await checkAuth();
      } else {
        Alert.alert('Error', json.error || 'Upload failed');
      }
    } catch {
      Alert.alert('Error', 'Upload failed');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAction = async () => {
    if (!selectedItem || !token) return;
    setIsActioning(true);
    try {
      const res = await fetch(ENDPOINTS.TRADES.CLOSE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spotify_id: selectedItem.data.spotify_id }),
      });
      if (res.ok) {
        fetchPortfolio();
        setModalVisible(false);
      } else {
        const d = await res.json();
        Alert.alert('Error', d.error || 'Action failed');
      }
    } catch {
      Alert.alert('Error', 'Network request failed');
    } finally {
      setIsActioning(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <Spinner size={32} />
      </View>
    );
  }

  const totalValue = (data?.balance || 0) + (data?.total_market_value || 0);

  return (
    <View style={styles.container}>
      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange as any}
      />

      <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgb(10, 10, 10)' }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={handleAvatarPress} disabled={avatarUploading} activeOpacity={0.7}>
            <View style={styles.avatarCircle}>
              {user?.avatar_url
                ? <Image source={{ uri: user.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                : <Text style={styles.avatarInitial}>{(user?.username?.[0] ?? '?').toUpperCase()}</Text>}
              {avatarUploading && (
                <View style={styles.avatarOverlay}>
                  <Spinner size={20} strokeWidth={1.5} />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{user?.username ?? 'Portfolio'}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerBalance}>
            <Text style={styles.headerBalanceLabel}>Available</Text>
            <Text style={styles.headerBalanceValue}>${(data?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>
      </div>

      <View style={styles.scrollContent}>
        {/* Summary Card */}
        <View style={styles.summaryGrid}>
          <View style={{ width: '100%', marginBottom: 24 }}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={styles.summaryValue}>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.summaryItem, { width: summaryItemWidth }]}>
            <Text style={styles.summaryLabel}>Open Positions</Text>
            <Text style={[styles.summaryValue, { fontSize: 24 }]}>${(data?.total_market_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.summaryItem, { width: summaryItemWidth }]}>
            <Text style={styles.summaryLabel}>Unrealized P&L</Text>
            <Text style={[styles.summaryValue, { fontSize: 24, color: (data?.total_unrealized_pnl || 0) >= 0 ? POSITIVE : NEGATIVE }]}>
              {(data?.total_unrealized_pnl || 0) >= 0 ? '+' : '-'}${Math.abs(data?.total_unrealized_pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setActiveTab('positions')}>
            <Text style={[styles.tabText, activeTab === 'positions' ? { color: '#fff' } : { color: '#52525b' }]}>Positions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('orders')}>
            <Text style={[styles.tabText, activeTab === 'orders' ? { color: '#fff' } : { color: '#52525b' }]}>Orders</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'positions' ? (
          <View>
            {data?.positions.length === 0 ? (
              <Text style={styles.emptyText}>No active positions</Text>
            ) : (
              data?.positions.map(pos => (
                <TouchableOpacity
                  key={pos.id}
                  style={styles.card}
                  onPress={() => {
                    setSelectedItem({ type: 'position', data: pos });
                    setModalVisible(true);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.artistName}>{pos.artist_name}</Text>
                    <View style={[styles.sideBadge, { backgroundColor: pos.position_type === 'long' ? 'rgba(4,223,162,1)' : 'rgba(255,75,75,1)' }]}>
                      <Text style={styles.sideText}>{pos.position_type.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardStat}>
                      <Text style={styles.statLabel}>Size</Text>
                      <Text style={styles.statValue}>{pos.contracts}</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Text style={styles.statLabel}>Entry</Text>
                      <Text style={styles.statValue}>${pos.entry_price.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.cardStat, { alignItems: 'flex-end' }]}>
                      <Text style={styles.statLabel}>P&L</Text>
                      <Text style={[styles.statValue, { color: (pos.unrealized_pnl ?? 0) >= 0 ? POSITIVE : NEGATIVE }]}>
                        {pos.unrealized_pnl != null ? `${pos.unrealized_pnl >= 0 ? '+' : '-'}$${Math.abs(pos.unrealized_pnl).toFixed(2)}` : '—'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionHeader}>Open Orders</Text>
            {data?.open_orders.length === 0 ? (
              <Text style={styles.emptyText}>No open orders</Text>
            ) : (
              data?.open_orders.map(order => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.card}
                  onPress={() => {
                    setSelectedItem({ type: 'order', data: order });
                    setModalVisible(true);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.artistName}>{order.artist_name}</Text>
                    <View style={[styles.sideBadge, { backgroundColor: order.side === 'buy' ? 'rgba(4,223,162,1)' : 'rgba(255,75,75,1)' }]}>
                      <Text style={styles.sideText}>{order.side === 'buy' ? 'LONG' : 'SHORT'}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardStat}>
                      <Text style={styles.statLabel}>Price</Text>
                      <Text style={styles.statValue}>${order.price.toFixed(2)}</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Text style={styles.statLabel}>Contracts</Text>
                      <Text style={styles.statValue}>{order.quantity}</Text>
                    </View>
                    <View style={[styles.cardStat, { alignItems: 'flex-end' }]}>
                      <Text style={styles.statLabel}>Status</Text>
                      <Text style={styles.statValue}>{order.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <Text style={[styles.sectionHeader, { marginTop: 32 }]}>Closed Positions</Text>
            {closedPositions.length === 0 ? (
              <Text style={styles.emptyText}>No closed positions</Text>
            ) : (
              closedPositions.map(pos => (
                <TouchableOpacity
                  key={pos.id}
                  style={styles.card}
                  onPress={() => {
                    setSelectedItem({ type: 'closed_position', data: pos });
                    setModalVisible(true);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.artistName}>{pos.artist_name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {pos.status === 'liquidated' && (
                        <View style={[styles.sideBadge, { backgroundColor: '#7c2d12' }]}>
                          <Text style={styles.sideText}>LIQD</Text>
                        </View>
                      )}
                      <View style={[styles.sideBadge, { backgroundColor: pos.position_type === 'long' ? 'rgba(4,223,162,1)' : 'rgba(255,75,75,1)' }]}>
                        <Text style={styles.sideText}>{pos.position_type.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardStat}>
                      <Text style={styles.statLabel}>Exit</Text>
                      <Text style={styles.statValue}>${pos.current_price != null ? pos.current_price.toFixed(2) : '—'}</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Text style={styles.statLabel}>Contracts</Text>
                      <Text style={styles.statValue}>{pos.contracts}</Text>
                    </View>
                    <View style={[styles.cardStat, { alignItems: 'flex-end' }]}>
                      <Text style={styles.statLabel}>PnL</Text>
                      <Text style={[styles.statValue, { color: (pos.unrealized_pnl ?? 0) >= 0 ? POSITIVE : NEGATIVE }]}>
                        {pos.unrealized_pnl != null ? `${pos.unrealized_pnl >= 0 ? '+' : ''}$${pos.unrealized_pnl.toFixed(2)}` : '—'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
      </View>

      {/* Details Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.bottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {selectedItem?.type === 'position' ? 'Position Details' : selectedItem?.type === 'closed_position' ? 'Closed Position' : 'Order Details'}
              </Text>
            </View>

            <View style={styles.sheetContent}>
              <View style={styles.detailGroup}>
                {selectedItem?.type === 'position' ? (
                  <>
                    <DetailRow label="Artist" value={selectedItem.data.artist_name} />
                    <DetailRow
                      label="Side"
                      value={selectedItem.data.position_type.toUpperCase()}
                      valueColor={selectedItem.data.position_type === 'long' ? POSITIVE : NEGATIVE}
                    />
                    <DetailRow label="Contracts" value={String(selectedItem.data.contracts)} />
                    <DetailRow label="Entry Price" value={`$${selectedItem.data.entry_price.toFixed(2)}`} />
                    <DetailRow label="Total Entry" value={`$${selectedItem.data.total_cost.toFixed(2)}`} />
                    <DetailRow label="Current Price" value={selectedItem.data.current_price != null ? `$${selectedItem.data.current_price.toFixed(2)}` : '—'} />
                    <DetailRow label="Market Value" value={selectedItem.data.market_value != null ? `$${selectedItem.data.market_value.toFixed(2)}` : '—'} />
                    <DetailRow
                      label="Unrealized PnL"
                      value={selectedItem.data.unrealized_pnl != null ? `${selectedItem.data.unrealized_pnl >= 0 ? '+' : ''}$${selectedItem.data.unrealized_pnl.toFixed(2)}` : '—'}
                      valueColor={(selectedItem.data.unrealized_pnl ?? 0) >= 0 ? POSITIVE : NEGATIVE}
                    />
                  </>
                ) : selectedItem?.type === 'closed_position' ? (
                  <>
                    <DetailRow label="Artist" value={selectedItem.data.artist_name} />
                    <DetailRow
                      label="Side"
                      value={selectedItem.data.position_type.toUpperCase()}
                      valueColor={selectedItem.data.position_type === 'long' ? POSITIVE : NEGATIVE}
                    />
                    <DetailRow label="Contracts" value={String(selectedItem.data.contracts)} />
                    <DetailRow label="Entry Price" value={`$${selectedItem.data.entry_price.toFixed(2)}`} />
                    <DetailRow label="Exit Price" value={selectedItem.data.current_price != null ? `$${selectedItem.data.current_price.toFixed(2)}` : '—'} />
                    <DetailRow
                      label="Realized PnL"
                      value={selectedItem.data.unrealized_pnl != null ? `${selectedItem.data.unrealized_pnl >= 0 ? '+' : ''}$${selectedItem.data.unrealized_pnl.toFixed(2)}` : '—'}
                      valueColor={(selectedItem.data.unrealized_pnl ?? 0) >= 0 ? POSITIVE : NEGATIVE}
                    />
                    <DetailRow label="Opened" value={new Date(selectedItem.data.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <DetailRow label="Closed" value={new Date(selectedItem.data.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <DetailRow
                      label="Status"
                      value={selectedItem.data.status.toUpperCase()}
                      valueColor={selectedItem.data.status === 'liquidated' ? NEGATIVE : '#fff'}
                    />
                  </>
                ) : selectedItem?.type === 'order' ? (
                  <>
                    <DetailRow label="Artist" value={selectedItem.data.artist_name} />
                    <DetailRow label="Date" value={new Date(selectedItem.data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                    <DetailRow
                      label="Side"
                      value={selectedItem.data.side === 'buy' ? 'LONG' : 'SHORT'}
                      valueColor={selectedItem.data.side === 'buy' ? POSITIVE : NEGATIVE}
                    />
                    <DetailRow label="Type" value={selectedItem.data.order_type.toUpperCase()} />
                    <DetailRow label="Price" value={`$${selectedItem.data.price.toFixed(2)}`} />
                    <DetailRow label="Filled / Total" value={`${selectedItem.data.filled_quantity} / ${selectedItem.data.quantity}`} />
                    <DetailRow label="Status" value={selectedItem.data.status.toUpperCase()} />
                  </>
                ) : null}
              </View>

              <View style={styles.modalActions}>
                {selectedItem?.type !== 'closed_position' && (
                  <TouchableOpacity
                    style={styles.closeTradeBtn}
                    onPress={handleAction}
                    disabled={isActioning}
                  >
                    <Text style={styles.closeTradeBtnText}>
                      {isActioning ? 'Processing...' : selectedItem?.type === 'position' ? 'Close Position' : 'Cancel Order'}
                    </Text>
                  </TouchableOpacity>
                )}

                {(selectedItem?.type === 'position' || selectedItem?.type === 'closed_position') && (
                  <TouchableOpacity
                    style={styles.viewArtistBtn}
                    onPress={() => {
                      const pos = selectedItem.data;
                      setModalVisible(false);
                      setShareData({
                        artistName: pos.artist_name,
                        contracts: pos.contracts,
                        position: pos.position_type,
                        profitLoss: pos.unrealized_pnl,
                        entryPrice: pos.entry_price,
                        currentPrice: pos.current_price,
                        username: (user as any)?.username || data?.username || 'Trader',
                        isOpen: selectedItem.type === 'position',
                      });
                    }}
                  >
                    <Text style={styles.viewArtistBtnText}>Share Position</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.viewArtistBtn, { borderColor: '#27272a' }]}
                  onPress={() => {
                    setModalVisible(false);
                    router.push(`/artist/${encodeURIComponent(selectedItem?.data.spotify_id ?? selectedItem?.data.artist_name)}`);
                  }}
                >
                  <Text style={styles.viewArtistBtnText}>View Artist Page</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>
      {shareData && <SharePositionSheet data={shareData} onClose={() => setShareData(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    overflow: 'visible' as any,
  },
  center: {
    minHeight: 'calc(100vh - 64px)' as any,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    color: '#111',
    fontWeight: '700',
    fontSize: 16,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBalance: {
    alignItems: 'flex-end',
  },
  logoutBtn: {
    padding: 8,
  },
  headerBalanceLabel: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerBalanceValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 32,
  },
  summaryItem: {
    backgroundColor: Colors.dark.background,
    marginBottom: 20,
  },
  summaryLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    paddingTop: 20,
  },
  tabText: {
    fontSize: 22,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.dark.background,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  artistName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sideText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardStat: {
    flex: 1,
  },
  statLabel: {
    color: '#71717a',
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: '#71717a',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3f3f46',
    borderRadius: 2,
    marginBottom: 32,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sheetContent: {
    paddingTop: 24,
  },
  detailGroup: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#71717a',
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    gap: 12,
  },
  closeTradeBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 99,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  closeTradeBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  viewArtistBtn: {
    paddingVertical: 14,
    borderRadius: 99,
    alignItems: 'center',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1c1c1e',
  },
  viewArtistBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionHeader: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 8,
  },
});
