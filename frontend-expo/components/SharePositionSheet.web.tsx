import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Spinner } from '@/components/Spinner';

export interface ShareData {
  artistName: string;
  contracts: number;
  position: 'long' | 'short';
  profitLoss: number;
  entryPrice: number;
  currentPrice: number;
  username: string;
  isOpen?: boolean;
}

const POS_COLOR = '#22c55e';
const NEG_COLOR = '#ef4444';
const CARD_BG = 'rgb(10,10,10)';

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
  ctx.closePath();
}

async function generateCardBlob(data: ShareData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const isProfitable = data.profitLoss >= 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const W = 360;
    const P = 20;       // card padding
    const BP = 16;      // position box padding
    const IW = W - P * 2; // inner width 320

    // ── measure heights ──
    // Row 1: "Trader"(11) + gap(2) + name(15) + descent ≈ 32
    const R1_H = 32;
    // Position box inner content:
    //   cols: posLabel(11)+gap(4)+posArtist(18)+descent(5) = 38
    //   divider: marginTop(16)+1+marginBottom(12) = 29
    //   stats: statLabel(11)+gap(2)+statVal(13)+descent(4) = 30
    const BOX_INNER = BP + 38 + 29 + 30 + BP; // 16+38+29+30+16=129
    // Footer: 20
    const H = P + R1_H + 20 + BOX_INNER + 20 + 20 + P; // 20+32+20+129+20+20+20=261
    const boxTop = P + R1_H + 20; // 72

    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('no ctx')); return; }
    ctx.scale(dpr, dpr);

    // ── Card background + border ──
    ctx.fillStyle = CARD_BG;
    rrect(ctx, 0, 0, W, H, 12);
    ctx.fill();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    rrect(ctx, 0.5, 0.5, W - 1, H - 1, 11.5);
    ctx.stroke();

    // ── Row 1: Trader label + name + pill ──
    ctx.fillStyle = '#71717a';
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText('Trader', P, P + 11);

    ctx.fillStyle = '#fff';
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(data.username, P, P + 11 + 3 + 15);

    // Contracts pill
    ctx.font = `400 11px ${FONT}`;
    const pillTxt = `${data.contracts} contract${data.contracts !== 1 ? 's' : ''}`;
    const ptw = ctx.measureText(pillTxt).width;
    const pH = 19, pPH = 12, pPV = 4;
    const pW = ptw + pPH * 2;
    const pX = W - P - pW;
    const pY = P + (R1_H - pH) / 2;

    ctx.fillStyle = '#27272a';
    rrect(ctx, pX, pY, pW, pH, pH / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillTxt, pX + pPH, pY + pH / 2);
    ctx.textBaseline = 'alphabetic';

    // ── Position box ──
    ctx.fillStyle = '#18181b';
    rrect(ctx, P, boxTop, IW, BOX_INNER, 8);
    ctx.fill();
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    rrect(ctx, P + 0.5, boxTop + 0.5, IW - 1, BOX_INNER - 1, 7.5);
    ctx.stroke();

    const bx = P + BP;            // 36
    const rX = W - P - BP;        // right edge for right-aligned text
    let by = boxTop + BP;          // 88

    // posLabel
    ctx.fillStyle = '#71717a';
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText(`I'm ${data.position}`, bx, by + 11);

    // pnlLabel (right-aligned)
    ctx.textAlign = 'right';
    ctx.fillText('Unrealized PnL', rX, by + 11);
    ctx.textAlign = 'left';

    by += 11 + 4; // advance past label row

    // posArtist (left)
    ctx.fillStyle = '#fff';
    ctx.font = `500 18px ${FONT}`;
    // clip long names
    let artTxt = data.artistName;
    const maxAW = IW - BP * 2 - 110;
    while (ctx.measureText(artTxt).width > maxAW && artTxt.length > 1) artTxt = artTxt.slice(0, -1);
    if (artTxt !== data.artistName) artTxt += '…';
    ctx.fillText(artTxt, bx, by + 18);

    // pnlValue (right-aligned)
    const pnlStr = `${isProfitable ? '+' : ''}$${data.profitLoss.toFixed(2)}`;
    ctx.fillStyle = isProfitable ? POS_COLOR : NEG_COLOR;
    ctx.font = `600 18px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(pnlStr, rX, by + 18);
    ctx.textAlign = 'left';

    by += 18 + 5; // colBottom

    // divider
    by += 16; // marginTop
    ctx.fillStyle = '#27272a';
    ctx.fillRect(bx, by, IW - BP * 2, 1);
    by += 1 + 12; // through divider + marginBottom

    // stats
    ctx.fillStyle = '#71717a';
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText('Entry', bx, by + 11);
    ctx.fillText('Current', bx + 80, by + 11);
    by += 11 + 2;
    ctx.fillStyle = '#fff';
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText(`$${data.entryPrice.toFixed(2)}`, bx, by + 13);
    ctx.fillText(`$${data.currentPrice.toFixed(2)}`, bx + 80, by + 13);

    // ── Footer ──
    const fy = boxTop + BOX_INNER + 20;
    ctx.fillStyle = '#52525b';
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText('Sonotrade', P, fy + 16);
    ctx.font = `400 10px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('index.sonotrade.io', W - P, fy + 12);
    ctx.textAlign = 'left';

    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
  });
}

export function SharePositionSheet({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const isProfitable = data.profitLoss >= 0;
  const [isCapturing, setIsCapturing] = useState(false);

  const handleShare = async () => {
    setIsCapturing(true);
    try {
      const blob = await generateCardBlob(data);
      const file = new File([blob], 'sonotrade-position.png', { type: 'image/png' });
      if ((navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({ files: [file], title: 'My Sonotrade Position' });
      } else {
        // Fallback: download image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sonotrade-position.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('Share failed', e);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.overlay} onPress={onClose}>
        <View style={ss.sheet} onStartShouldSetResponder={() => true}>
          <View style={ss.sheetHeader}>
            <View style={ss.handle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 16 }}>
              <Text style={ss.title}>Share your position</Text>
              <TouchableOpacity onPress={onClose}><Text style={{ color: '#71717a', fontSize: 16 }}>✕</Text></TouchableOpacity>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            {/* Card preview — pixel-matches the generated PNG */}
            <View style={ss.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={ss.traderLabel}>Trader</Text>
                  <Text style={ss.traderName}>{data.username}</Text>
                </View>
                <View style={ss.contractsPill}>
                  <Text style={ss.contractsText}>{data.contracts} contract{data.contracts !== 1 ? 's' : ''}</Text>
                </View>
              </View>

              <View style={ss.positionBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={ss.posLabel}>I'm {data.position}</Text>
                    <Text style={ss.posArtist} numberOfLines={1}>{data.artistName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={ss.pnlLabel}>Unrealized PnL</Text>
                    <Text style={[ss.pnlValue, { color: isProfitable ? POS_COLOR : NEG_COLOR }]}>
                      {isProfitable ? '+' : ''}${data.profitLoss.toFixed(2)}
                    </Text>
                  </View>
                </View>
                <View style={ss.divider} />
                <View style={{ flexDirection: 'row', gap: 24 }}>
                  <View>
                    <Text style={ss.statLabel}>Entry</Text>
                    <Text style={ss.statVal}>${data.entryPrice.toFixed(2)}</Text>
                  </View>
                  <View>
                    <Text style={ss.statLabel}>Current</Text>
                    <Text style={ss.statVal}>${data.currentPrice.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                <Text style={ss.brandName}>Sonotrade</Text>
                <Text style={ss.brandUrl}>index.sonotrade.io</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
              <Text style={{ color: '#71717a', fontSize: 12 }}>Share your position card as an image.</Text>
              <TouchableOpacity style={ss.shareBtn} onPress={handleShare} disabled={isCapturing}>
                {isCapturing
                  ? <Spinner size={16} strokeWidth={1.5} />
                  : <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                }
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: 40 }} />
        </View>
      </Pressable>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  sheetHeader:   { alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1c1c1e', marginBottom: 16 },
  handle:        { width: 36, height: 4, backgroundColor: '#3f3f46', borderRadius: 2, marginBottom: 12 },
  title:         { color: '#fff', fontSize: 15, fontWeight: '500' },
  card:          { borderWidth: 1, borderColor: '#3f3f46', borderRadius: 12, backgroundColor: CARD_BG, padding: 20 },
  traderLabel:   { color: '#71717a', fontSize: 11 },
  traderName:    { color: '#fff', fontSize: 15, fontWeight: '500', marginTop: 2 },
  contractsPill: { backgroundColor: '#27272a', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  contractsText: { color: '#fff', fontSize: 11 },
  positionBox:   { borderWidth: 1, borderColor: '#27272a', backgroundColor: '#18181b', borderRadius: 8, padding: 16, marginTop: 20 },
  posLabel:      { color: '#71717a', fontSize: 11 },
  posArtist:     { color: '#fff', fontSize: 18, fontWeight: '500', marginTop: 4 },
  pnlLabel:      { color: '#71717a', fontSize: 11 },
  pnlValue:      { fontSize: 18, fontWeight: '600', marginTop: 4 },
  divider:       { height: 1, backgroundColor: '#27272a', marginTop: 16, marginBottom: 12 },
  statLabel:     { color: '#71717a', fontSize: 11 },
  statVal:       { color: '#fff', fontSize: 13, fontWeight: '500', marginTop: 2 },
  brandName:     { color: '#52525b', fontSize: 16, fontWeight: '400' },
  brandUrl:      { color: '#52525b', fontSize: 10 },
  shareBtn:      { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#3f3f46', justifyContent: 'center', alignItems: 'center' },
});
