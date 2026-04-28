import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, RotateCcw, Trash2, Download, Save, ChevronDown,
  AlertTriangle, CheckCircle, AlertCircle, Info, ZapOff,
  Layers, MapPin, Star, History, X, Plus, Eye, EyeOff,
} from 'lucide-react';
import {
  ZONES_16, ZONE_ELEMENTS, analyzeVastu, polygonCentroid,
  allRoomsCentroid, getZone,
} from './lib/vastu';
import { supabase, getSessionId } from './lib/supabase';
import type { Point, Room, RoomType, Planet, AnalysisResult, SavedAnalysis, Severity } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 920;
const CANVAS_H = 640;

const ROOM_TYPES: { value: RoomType; label: string; color: string; fill: string }[] = [
  { value: 'Kitchen',       label: 'Kitchen',         color: '#ea580c', fill: 'rgba(234,88,12,0.25)' },
  { value: 'MasterBedroom', label: 'Master Bedroom',  color: '#0d9488', fill: 'rgba(13,148,136,0.25)' },
  { value: 'Bedroom',       label: 'Bedroom',         color: '#0284c7', fill: 'rgba(2,132,199,0.25)' },
  { value: 'Toilet',        label: 'Toilet',          color: '#dc2626', fill: 'rgba(220,38,38,0.25)' },
  { value: 'Bathroom',      label: 'Bathroom',        color: '#db2777', fill: 'rgba(219,39,119,0.22)' },
  { value: 'MainDoor',      label: 'Main Door',       color: '#16a34a', fill: 'rgba(22,163,74,0.30)' },
  { value: 'Pooja',         label: 'Pooja Room',      color: '#ca8a04', fill: 'rgba(202,138,4,0.28)' },
  { value: 'LivingRoom',    label: 'Living Room',     color: '#2563eb', fill: 'rgba(37,99,235,0.22)' },
  { value: 'DiningRoom',    label: 'Dining Room',     color: '#d97706', fill: 'rgba(217,119,6,0.22)' },
  { value: 'StudyRoom',     label: 'Study Room',      color: '#0891b2', fill: 'rgba(8,145,178,0.22)' },
  { value: 'StoreRoom',     label: 'Store Room',      color: '#57534e', fill: 'rgba(87,83,78,0.22)' },
  { value: 'Garage',        label: 'Garage',          color: '#44403c', fill: 'rgba(68,64,60,0.22)' },
  { value: 'Balcony',       label: 'Balcony',         color: '#059669', fill: 'rgba(5,150,105,0.18)' },
  { value: 'Staircase',     label: 'Staircase',       color: '#7c3aed', fill: 'rgba(124,58,237,0.22)' },
  { value: 'Basement',      label: 'Basement',        color: '#374151', fill: 'rgba(55,65,81,0.22)' },
  { value: 'Well',          label: 'Well / Borewell', color: '#1d4ed8', fill: 'rgba(29,78,216,0.25)' },
  { value: 'Overhead_Tank', label: 'Overhead Tank',   color: '#0369a1', fill: 'rgba(3,105,161,0.22)' },
];

const PLANETS: Planet[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

function roomConfig(type: RoomType) {
  return ROOM_TYPES.find(r => r.value === type) ?? ROOM_TYPES[0];
}

// ─── Canvas Drawing ────────────────────────────────────────────────────────────

function drawCanvas(
  canvas: HTMLCanvasElement,
  opts: {
    image: HTMLImageElement | null;
    imageOpacity: number;
    rooms: Room[];
    drawingPoints: Point[];
    mousePos: Point | null;
    northOffset: number;
    brahmasthan: Point | null;
    showZones: boolean;
    selectedRoomId: string | null;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { image, imageOpacity, rooms, drawingPoints, mousePos, northOffset, brahmasthan, showZones, selectedRoomId } = opts;
  const W = canvas.width;
  const H = canvas.height;
  const center = brahmasthan ?? { x: W / 2, y: H / 2 };

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Grid dots
  ctx.fillStyle = 'rgba(148,163,184,0.4)';
  for (let gx = 20; gx < W; gx += 40) {
    for (let gy = 20; gy < H; gy += 40) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Floor plan image
  if (image) {
    ctx.globalAlpha = imageOpacity;
    const ratio = Math.min((W - 40) / image.width, (H - 40) / image.height);
    const iw = image.width * ratio;
    const ih = image.height * ratio;
    ctx.drawImage(image, (W - iw) / 2, (H - ih) / 2, iw, ih);
    ctx.globalAlpha = 1;
  }

  // Zone wedges
  if (showZones) {
    const maxR = Math.max(W, H) * 0.8;
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const zone = ZONES_16[i];
      const startDeg = northOffset - 90 + i * 22.5 - 11.25;
      const endDeg = startDeg + 22.5;
      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;

      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, maxR, startRad, endRad);
      ctx.closePath();
      ctx.fillStyle = ZONE_ELEMENTS[zone].color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,116,139,0.22)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Zone label
      const midRad = startRad + (endRad - startRad) / 2;
      const labelR = Math.min(W, H) * 0.36;
      const lx = center.x + Math.cos(midRad) * labelR;
      const ly = center.y + Math.sin(midRad) * labelR;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.fillStyle = 'rgba(30,41,59,0.65)';
      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Compass arrows
    const compassR = 36;
    const arrows = [
      { label: 'N', deg: northOffset - 90, color: '#0ea5e9' },
      { label: 'E', deg: northOffset, color: '#22c55e' },
      { label: 'S', deg: northOffset + 90, color: '#ef4444' },
      { label: 'W', deg: northOffset + 180, color: '#f59e0b' },
    ];
    for (const a of arrows) {
      const rad = (a.deg * Math.PI) / 180;
      const tx = center.x + Math.cos(rad) * compassR;
      const ty = center.y + Math.sin(rad) * compassR;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = a.color;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.label, tx + Math.cos(rad) * 13, ty + Math.sin(rad) * 13);
    }
  }

  // Drawn rooms
  for (const room of rooms) {
    if (room.points.length < 2) continue;
    const cfg = roomConfig(room.type);
    const isSelected = room.id === selectedRoomId;

    ctx.beginPath();
    ctx.moveTo(room.points[0].x, room.points[0].y);
    for (let i = 1; i < room.points.length; i++) ctx.lineTo(room.points[i].x, room.points[i].y);
    ctx.closePath();
    ctx.fillStyle = cfg.fill;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#f59e0b' : cfg.color;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.setLineDash(isSelected ? [6, 3] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    // Room label
    const c = polygonCentroid(room.points);
    ctx.fillStyle = cfg.color;
    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.name, c.x, c.y - 6);
    ctx.fillStyle = 'rgba(71,85,105,0.8)';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.fillText(room.type.replace(/([A-Z])/g, ' $1').trim().replace('_ ', ' '), c.x, c.y + 7);

    if (room.zone && showZones) {
      ctx.fillStyle = 'rgba(71,85,105,0.6)';
      ctx.font = '8px Inter, system-ui, sans-serif';
      ctx.fillText(`[${room.zone}]`, c.x, c.y + 18);
    }
  }

  // Active drawing polygon
  if (drawingPoints.length > 0) {
    ctx.beginPath();
    ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
    for (let i = 1; i < drawingPoints.length; i++) ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
    if (mousePos) ctx.lineTo(mousePos.x, mousePos.y);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const p of drawingPoints) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0ea5e9';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Close hint near first point
    if (drawingPoints.length >= 3) {
      const fp = drawingPoints[0];
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(14,165,233,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Brahmasthan marker
  if (brahmasthan) {
    const bx = brahmasthan.x;
    const by = brahmasthan.y;
    const size = 18;

    ctx.save();
    ctx.shadowColor = 'rgba(16,185,129,0.6)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(16,185,129,0.2)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(bx - size, by - size, size * 2, size * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx - size, by); ctx.lineTo(bx + size, by);
    ctx.moveTo(bx, by - size); ctx.lineTo(bx, by + size);
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('BRAHMASTHAN', bx, by + size + 3);
  }
}

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0.5);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [northOffset, setNorthOffset] = useState(0);
  const [brahmasthan, setBrahmasthan] = useState<Point | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [weakPlanets, setWeakPlanets] = useState<Planet[]>([]);
  const [activeTab, setActiveTab] = useState<'draw' | 'analyze' | 'history'>('draw');
  const [floorName, setFloorName] = useState('My Floor Plan');
  const [ownerName, setOwnerName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().slice(0, 10));
  const [pendingType, setPendingType] = useState<RoomType>('LivingRoom');
  const [pendingName, setPendingName] = useState('Living Room');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [modalType, setModalType] = useState<RoomType>('LivingRoom');
  const [modalName, setModalName] = useState('');
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const getCenter = useCallback((): Point => {
    if (brahmasthan) return brahmasthan;
    return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  }, [brahmasthan]);

  // Canvas redraw on state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCanvas(canvas, {
      image, imageOpacity, rooms, drawingPoints, mousePos,
      northOffset, brahmasthan, showZones, selectedRoomId,
    });
  }, [image, imageOpacity, rooms, drawingPoints, mousePos, northOffset, brahmasthan, showZones, selectedRoomId]);

  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) {
      const pt = getCanvasPoint(e);
      const clicked = [...rooms].reverse().find(r =>
        r.points.length >= 3 && isPointInPoly(pt, r.points)
      );
      setSelectedRoomId(clicked?.id ?? null);
      return;
    }
    const pt = getCanvasPoint(e);
    if (drawingPoints.length >= 3) {
      const fp = drawingPoints[0];
      const dist = Math.hypot(pt.x - fp.x, pt.y - fp.y);
      if (dist < 12) { openRoomModal(); return; }
    }
    setDrawingPoints(prev => [...prev, pt]);
  }

  function handleCanvasDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing || drawingPoints.length < 3) return;
    openRoomModal();
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) { setMousePos(null); return; }
    setMousePos(getCanvasPoint(e));
  }

  function openRoomModal() {
    setModalType(pendingType);
    setModalName(pendingName);
    setShowRoomModal(true);
  }

  function confirmRoom() {
    if (drawingPoints.length < 3) return;
    const center = getCenter();
    const centroid = polygonCentroid(drawingPoints);
    const zone = getZone(centroid, center, northOffset);
    const newRoom: Room = {
      id: crypto.randomUUID(),
      name: modalName || modalType,
      type: modalType,
      points: [...drawingPoints],
      zone,
      centroid,
    };
    setRooms(prev => [...prev, newRoom]);
    setDrawingPoints([]);
    setIsDrawing(false);
    setMousePos(null);
    setShowRoomModal(false);
    setAnalysisResult(null);
  }

  function cancelDraw() {
    setDrawingPoints([]);
    setIsDrawing(false);
    setMousePos(null);
    setShowRoomModal(false);
  }

  function startDrawing() {
    setIsDrawing(true);
    setDrawingPoints([]);
    setSelectedRoomId(null);
    setAnalysisResult(null);
  }

  function deleteRoom(id: string) {
    setRooms(prev => prev.filter(r => r.id !== id));
    if (selectedRoomId === id) setSelectedRoomId(null);
    setAnalysisResult(null);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
  }

  function computeBrahmasthan() {
    const center = allRoomsCentroid(rooms);
    if (center) {
      setBrahmasthan(center);
      showToast('Brahmasthan calculated at geometric centroid', 'success');
    } else {
      setBrahmasthan({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
      showToast('Using canvas center as Brahmasthan', 'success');
    }
  }

  function runAnalysis() {
    const center = getCenter();
    const updatedRooms = rooms.map(room => ({
      ...room,
      zone: getZone(polygonCentroid(room.points), center, northOffset),
      centroid: polygonCentroid(room.points),
    }));
    setRooms(updatedRooms);
    const result = analyzeVastu(updatedRooms, center, northOffset, weakPlanets);
    setAnalysisResult(result);
    setActiveTab('analyze');
  }

  async function saveToSupabase() {
    if (!analysisResult) { showToast('Run analysis first', 'error'); return; }
    setIsSaving(true);
    const userId = getSessionId();
    const { error } = await supabase.from('analyses').insert({
      user_id: userId,
      score: analysisResult.score,
      defects_json: analysisResult.defects,
      rooms_json: rooms,
      north_offset: northOffset,
      floor_name: floorName,
    });
    setIsSaving(false);
    if (error) { showToast('Save failed: ' + error.message, 'error'); }
    else { showToast('Analysis saved!', 'success'); loadHistory(); }
  }

  async function loadHistory() {
    const userId = getSessionId();
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (!error && data) setSavedAnalyses(data as SavedAnalysis[]);
  }

  async function exportPDF() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('VASTU SIDDHANT GUIDE — Analysis Report', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const reportDate = analysisDate
      ? new Date(analysisDate + 'T00:00:00').toLocaleDateString()
      : new Date().toLocaleDateString();
    doc.text(`${floorName} · ${reportDate}`, pageW - 14, 12, { align: 'right' });

    let coverY = 24;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(floorName, 14, coverY);
    coverY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    if (ownerName.trim()) {
      doc.text(`Owner: ${ownerName.trim()}`, 14, coverY);
      coverY += 4.2;
    }
    if (propertyAddress.trim()) {
      const addrLines = doc.splitTextToSize(`Address: ${propertyAddress.trim()}`, 135);
      doc.text(addrLines, 14, coverY);
      coverY += addrLines.length * 4.2;
    }
    doc.text(`Date of Analysis: ${reportDate}`, 14, coverY);
    coverY += 3;

    const imgData = canvas.toDataURL('image/png');
    const imgTop = Math.max(coverY + 2, 40);
    const iW = 135;
    const iH = (CANVAS_H / CANVAS_W) * iW;
    doc.addImage(imgData, 'PNG', 14, imgTop, iW, iH);

    if (analysisResult) {
      const sc = analysisResult.score;
      const sc0 = sc >= 75 ? [22, 163, 74] : sc >= 50 ? [202, 138, 4] : [220, 38, 38];
      doc.setFillColor(sc0[0], sc0[1], sc0[2]);
      doc.roundedRect(156, 22, 52, 28, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text(`${sc}`, 182, 38, { align: 'center' });
      doc.setFontSize(9);
      doc.text('/100 Vastu Score', 182, 45, { align: 'center' });

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Critical: ${analysisResult.defects.filter(d => d.severity === 'CRITICAL').length}`, 156, 58);
      doc.text(`High: ${analysisResult.defects.filter(d => d.severity === 'HIGH').length}`, 156, 64);
      doc.text(`Positives: ${analysisResult.positives.length}`, 156, 70);
      doc.text(`Brahmasthan: ${analysisResult.brahmasthhanSafe ? 'Clear' : 'OBSTRUCTED'}`, 156, 76);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      let y = 26;
      const x2 = 216;
      doc.text('Defects & Remedies', x2, y);
      y += 7;
      doc.setFontSize(7.5);

      for (const d of analysisResult.defects.slice(0, 14)) {
        if (y > 198) { doc.addPage(); y = 20; }
        const c = d.severity === 'CRITICAL' ? [220, 38, 38] :
          d.severity === 'HIGH' ? [234, 88, 12] : [202, 138, 4];
        doc.setFillColor(c[0], c[1], c[2]);
        doc.rect(x2, y - 2.5, 2.5, 2.5, 'F');
        doc.setTextColor(c[0], c[1], c[2]);
        doc.setFont('helvetica', 'bold');
        const iLines = doc.splitTextToSize(`[${d.severity}] ${d.issue}`, 76);
        doc.text(iLines, x2 + 4, y);
        y += iLines.length * 3.8;
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        const rLines = doc.splitTextToSize(`Remedy: ${d.remedy}`, 76);
        doc.text(rLines.slice(0, 2), x2 + 4, y);
        y += rLines.slice(0, 2).length * 3.5 + 2;
      }

      if (analysisResult.positives.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text('Positive Vastu Attributes', 14, 18);
        let py = 28;
        for (const pos of analysisResult.positives) {
          if (py > 200) break;
          const lines = doc.splitTextToSize(`• ${pos}`, 269);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          doc.text(lines, 14, py);
          py += lines.length * 5 + 2;
        }
      }
    }

    const pageH = 210;
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('made by RavMon', pageW / 2, pageH - 4, { align: 'center' });
    }

    doc.save(`vastu-report-${floorName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function togglePlanet(p: Planet) {
    setWeakPlanets(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  const severityStyle: Record<Severity, string> = {
    CRITICAL: 'text-red-700 bg-red-50 border-red-200',
    HIGH: 'text-orange-700 bg-orange-50 border-orange-200',
    MEDIUM: 'text-yellow-800 bg-yellow-50 border-yellow-200',
    LOW: 'text-blue-700 bg-blue-50 border-blue-200',
    POSITIVE: 'text-green-700 bg-green-50 border-green-200',
  };

  const severityIcon = (s: Severity) => {
    if (s === 'CRITICAL') return <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />;
    if (s === 'HIGH') return <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />;
    if (s === 'MEDIUM') return <Info size={12} className="flex-shrink-0 mt-0.5" />;
    return <CheckCircle size={12} className="flex-shrink-0 mt-0.5" />;
  };

  const scoreGrade = (s: number) =>
    s >= 85 ? { label: 'Excellent', cls: 'text-green-600' } :
    s >= 70 ? { label: 'Good', cls: 'text-teal-600' } :
    s >= 55 ? { label: 'Average', cls: 'text-yellow-600' } :
    s >= 40 ? { label: 'Below Average', cls: 'text-orange-600' } :
    { label: 'Poor — Critical Remedies Needed', cls: 'text-red-600' };

  useEffect(() => { loadHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cfg = ROOM_TYPES.find(r => r.value === pendingType);
    if (cfg) setPendingName(cfg.label);
  }, [pendingType]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-xl flex-shrink-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}>
              <MapPin size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-base font-extrabold tracking-tight leading-none">Vastu Siddhant Guide</h1>
                <span className="text-slate-500 text-xs hidden sm:block">16-Zone Floor Plan Analyzer</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={floorName}
              onChange={e => setFloorName(e.target.value)}
              className="hidden sm:block bg-slate-800 border border-slate-700 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-teal-500 w-40"
              placeholder="Floor plan name…"
            />
            <button onClick={exportPDF} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              <Download size={13} /> PDF
            </button>
            <button onClick={saveToSupabase} disabled={isSaving} className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold">
              <Save size={13} /> {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 bg-white border-r border-slate-200 flex flex-col overflow-y-auto flex-shrink-0 shadow-sm">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            {(['draw', 'analyze', 'history'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-all ${
                  activeTab === t ? 'text-teal-700 bg-white border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t === 'draw' ? <><Layers size={11} className="inline mr-0.5" />Draw</> :
                 t === 'analyze' ? <><Star size={11} className="inline mr-0.5" />Analyze</> :
                 <><History size={11} className="inline mr-0.5" />History</>}
              </button>
            ))}
          </div>

          {activeTab === 'draw' && (
            <div className="p-3 space-y-4 flex-1">
              {/* Report Details */}
              <section>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Report Details</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="Owner name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-teal-400 mb-2"
                />
                <textarea
                  value={propertyAddress}
                  onChange={e => setPropertyAddress(e.target.value)}
                  placeholder="Property address"
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-teal-400 mb-2 resize-none"
                />
                <input
                  type="date"
                  value={analysisDate}
                  onChange={e => setAnalysisDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-teal-400"
                />
                <p className="text-xs text-slate-400 mt-1">Shown on the PDF report cover</p>
              </section>

              {/* Upload */}
              <section>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Floor Plan Image</label>
                <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-2 justify-center border-2 border-dashed border-slate-300 hover:border-teal-400 text-slate-500 hover:text-teal-600 rounded-xl py-3 text-xs transition-colors">
                  <Upload size={14} /> Upload JPG / PNG
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={handleImageUpload} className="hidden" />
                {image && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-500">Opacity</span>
                      <span className="text-xs text-teal-700 font-mono">{Math.round(imageOpacity * 100)}%</span>
                    </div>
                    <input type="range" min="0.1" max="1" step="0.05" value={imageOpacity}
                      onChange={e => setImageOpacity(parseFloat(e.target.value))}
                      className="w-full accent-teal-600 h-1" />
                  </div>
                )}
              </section>

              {/* North */}
              <section>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">North Direction</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-teal-700 tabular-nums">{northOffset}°</span>
                    <button onClick={() => setNorthOffset(0)} title="Reset" className="text-slate-400 hover:text-slate-600">
                      <RotateCcw size={11} />
                    </button>
                  </div>
                </div>
                <input type="range" min="0" max="359" step="1" value={northOffset}
                  onChange={e => setNorthOffset(parseInt(e.target.value))}
                  className="w-full accent-teal-600 h-1" />
                <p className="text-xs text-slate-400 mt-1">Rotate to orient North on canvas</p>
              </section>

              {/* Zone toggle */}
              <button onClick={() => setShowZones(v => !v)}
                className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors font-medium ${
                  showZones ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                {showZones ? <Eye size={13} /> : <EyeOff size={13} />}
                {showZones ? '16 Zones Visible' : '16 Zones Hidden'}
              </button>

              {/* Room drawing tool */}
              <section>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Draw Room</label>
                <div className="relative mb-2">
                  <select value={pendingType} onChange={e => setPendingType(e.target.value as RoomType)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-teal-400 pr-7">
                    {ROOM_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>
                <input type="text" value={pendingName} onChange={e => setPendingName(e.target.value)}
                  placeholder="Room name…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-teal-400 mb-2" />
                {!isDrawing ? (
                  <button onClick={startDrawing}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-xs py-2 rounded-lg transition-colors font-semibold">
                    <Plus size={13} /> Draw Room Polygon
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1.5 rounded-lg leading-relaxed">
                      Click to place corners · Double-click or click near start point to finish
                    </p>
                    <div className="flex gap-1.5">
                      {drawingPoints.length >= 3 && (
                        <button onClick={openRoomModal}
                          className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-xs py-1.5 rounded-lg transition-colors font-semibold">
                          Finish
                        </button>
                      )}
                      <button onClick={cancelDraw}
                        className="flex-1 flex items-center justify-center gap-1 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs py-1.5 rounded-lg transition-colors">
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Brahmasthan */}
              <button onClick={computeBrahmasthan}
                className="w-full flex items-center gap-2 justify-center bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg transition-colors font-semibold">
                <MapPin size={13} /> Auto Brahmasthan
              </button>

              {/* Rooms list */}
              {rooms.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rooms ({rooms.length})</label>
                    <button onClick={() => { setRooms([]); setSelectedRoomId(null); setAnalysisResult(null); setBrahmasthan(null); }}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                      <Trash2 size={10} /> Clear all
                    </button>
                  </div>
                  <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
                    {rooms.map(room => {
                      const cfg = roomConfig(room.type);
                      return (
                        <div key={room.id} onClick={() => setSelectedRoomId(room.id === selectedRoomId ? null : room.id)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
                            selectedRoomId === room.id ? 'bg-amber-50 border border-amber-300' : 'hover:bg-slate-50 border border-transparent'
                          }`}>
                          <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: cfg.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate leading-none">{room.name}</p>
                            {room.zone && <p className="text-xs text-slate-400 leading-none mt-0.5">{room.zone} zone</p>}
                          </div>
                          <button onClick={ev => { ev.stopPropagation(); deleteRoom(room.id); }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-0.5 flex-shrink-0">
                            <X size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'analyze' && (
            <div className="p-3 space-y-4 flex-1">
              <section>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Weak Planets</label>
                <p className="text-xs text-slate-400 mb-2 leading-relaxed">Select your weak planets from your birth chart for amplified defect scoring.</p>
                <div className="grid grid-cols-3 gap-1">
                  {PLANETS.map(p => (
                    <button key={p} onClick={() => togglePlanet(p)}
                      className={`text-xs py-1 px-0.5 rounded-lg border transition-colors font-medium leading-none py-1.5 ${
                        weakPlanets.includes(p)
                          ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-700'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              </section>

              <button onClick={runAnalysis} disabled={rooms.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-colors shadow-sm">
                <Star size={14} /> Analyze Vastu
              </button>

              {analysisResult && (
                <div className="space-y-3">
                  {/* Score dial */}
                  <div className="text-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 border border-slate-200">
                    <div className="text-6xl font-black tabular-nums leading-none" style={{
                      color: analysisResult.score >= 75 ? '#16a34a' : analysisResult.score >= 50 ? '#ca8a04' : '#dc2626',
                    }}>
                      {analysisResult.score}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5 font-medium">/ 100 Vastu Score</div>
                    <div className={`text-sm font-bold mt-1 ${scoreGrade(analysisResult.score).cls}`}>
                      {scoreGrade(analysisResult.score).label}
                    </div>
                    <div className="mt-3 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div className="h-2.5 rounded-full transition-all duration-1000"
                        style={{
                          width: `${analysisResult.score}%`,
                          background: analysisResult.score >= 75 ? 'linear-gradient(90deg,#16a34a,#4ade80)' :
                            analysisResult.score >= 50 ? 'linear-gradient(90deg,#ca8a04,#fbbf24)' :
                            'linear-gradient(90deg,#dc2626,#f87171)',
                        }} />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    {[
                      { label: 'Critical', val: analysisResult.defects.filter(d => d.severity === 'CRITICAL').length, color: 'red' },
                      { label: 'High', val: analysisResult.defects.filter(d => d.severity === 'HIGH').length, color: 'orange' },
                      { label: 'Positive', val: analysisResult.positives.length, color: 'green' },
                    ].map(item => (
                      <div key={item.label} className={`bg-${item.color}-50 rounded-xl p-2 border border-${item.color}-100`}>
                        <div className={`text-${item.color}-600 font-extrabold text-xl leading-none`}>{item.val}</div>
                        <div className={`text-${item.color}-400 text-xs mt-0.5`}>{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Brahmasthan */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
                    analysisResult.brahmasthhanSafe
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {analysisResult.brahmasthhanSafe
                      ? <><CheckCircle size={12} /> Brahmasthan is clear</>
                      : <><AlertTriangle size={12} /> Brahmasthan obstructed!</>}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-3 space-y-2 flex-1">
              <button onClick={loadHistory} className="w-full text-xs text-slate-400 hover:text-teal-600 py-1 transition-colors">
                ↻ Refresh
              </button>
              {savedAnalyses.length === 0 && (
                <div className="text-center py-8">
                  <History size={28} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No saved analyses yet.</p>
                  <p className="text-xs text-slate-300 mt-1">Run analysis and save.</p>
                </div>
              )}
              {savedAnalyses.map(a => (
                <div key={a.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 hover:border-teal-300 transition-colors cursor-default">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 truncate flex-1">{a.floor_name}</span>
                    <span className="text-sm font-extrabold ml-2 tabular-nums" style={{
                      color: a.score >= 75 ? '#16a34a' : a.score >= 50 ? '#ca8a04' : '#dc2626'
                    }}>{a.score}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    {' · '}{a.defects_json.length} defects
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative bg-slate-200 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className={`w-full h-full object-contain block ${isDrawing ? 'cursor-crosshair' : 'cursor-default'}`}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setMousePos(null)}
            />

            {rooms.length === 0 && !isDrawing && !image && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/80 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Layers size={36} className="text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-semibold text-lg">Start drawing your floor plan</p>
                  <p className="text-slate-400 text-sm mt-1.5">Upload an image or use Draw Room to mark zones</p>
                </div>
              </div>
            )}

            {isDrawing && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-xs px-5 py-2 rounded-full shadow-xl flex items-center gap-2.5 pointer-events-none">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Click corners · Double-click or close to finish · {drawingPoints.length} points
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="bg-white border-t border-slate-200 px-4 py-1.5 flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
            <span className="font-medium text-slate-600">{rooms.length} room{rooms.length !== 1 ? 's' : ''}</span>
            {brahmasthan && <span className="text-emerald-600 flex items-center gap-1"><MapPin size={10} /> Brahmasthan</span>}
            <span>North: {northOffset}°</span>
            {weakPlanets.length > 0 && <span className="text-amber-600">Planets: {weakPlanets.join(', ')}</span>}
            {analysisResult && (
              <span className="ml-auto font-bold" style={{
                color: analysisResult.score >= 75 ? '#16a34a' : analysisResult.score >= 50 ? '#ca8a04' : '#dc2626'
              }}>
                Vastu Score: {analysisResult.score} / 100
              </span>
            )}
          </div>
        </main>

        {/* Right panel */}
        {analysisResult && activeTab === 'analyze' && (
          <aside className="w-80 bg-white border-l border-slate-200 overflow-y-auto flex-shrink-0 shadow-sm">
            <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Vastu Analysis</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {analysisResult.defects.filter(d => d.severity === 'CRITICAL').length} critical ·{' '}
                {analysisResult.defects.filter(d => d.severity === 'HIGH').length} high ·{' '}
                {analysisResult.positives.length} positive
              </p>
            </div>

            {analysisResult.defects.length === 0 && analysisResult.positives.length === 0 && (
              <div className="p-6 text-center">
                <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-slate-700">No defects found!</p>
                <p className="text-xs text-slate-400 mt-1">Excellent Vastu compliance.</p>
              </div>
            )}

            {analysisResult.defects.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <ZapOff size={12} className="text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Defects & Remedies</h3>
                </div>
                <div className="space-y-2">
                  {analysisResult.defects.map((d, i) => (
                    <div key={i} className={`rounded-xl border p-3 text-xs ${severityStyle[d.severity]}`}>
                      <div className="flex items-start gap-1.5 font-semibold mb-1.5 leading-snug">
                        {severityIcon(d.severity)}
                        <span>{d.severity} — {d.roomName}</span>
                      </div>
                      <p className="pl-4 leading-relaxed mb-1.5 font-normal opacity-90">{d.issue}</p>
                      <div className="pl-4 text-slate-500 leading-relaxed border-l-2 border-slate-200 ml-1">
                        <span className="font-semibold text-slate-600">Remedy: </span>
                        {d.remedy}
                      </div>
                      {d.amplifedByPlanet && (
                        <div className="pl-4 text-amber-600 font-semibold mt-1.5 flex items-center gap-1 text-xs">
                          <Star size={10} /> Amplified by weak {d.planet}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysisResult.positives.length > 0 && (
              <div className="p-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle size={12} className="text-green-500" />
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Positive Attributes</h3>
                </div>
                <div className="space-y-1.5">
                  {analysisResult.positives.map((pos, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2 border border-green-200 leading-relaxed">
                      <CheckCircle size={11} className="flex-shrink-0 mt-0.5 text-green-500" />
                      {pos}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(analysisResult.planetWeightage).length > 0 && (
              <div className="p-3 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Planetary Impact</h3>
                <div className="space-y-1.5">
                  {(Object.entries(analysisResult.planetWeightage) as [Planet, number][]).map(([planet, pts]) => (
                    <div key={planet} className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      <span className="text-amber-800 font-semibold">{planet}</span>
                      <span className="text-red-600 font-bold">−{pts} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 16-zone reference */}
            <div className="p-3 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Zone Reference</h3>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {ZONES_16.map(z => (
                  <div key={z} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0 border border-slate-200"
                      style={{ background: ZONE_ELEMENTS[z].color.replace(/[\d.]+\)/, '0.8)') }} />
                    <span className="font-bold text-slate-700 w-8">{z}</span>
                    <span className="text-slate-400 truncate text-xs">{ZONE_ELEMENTS[z].deity}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Room modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200">
            <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
              <Plus size={16} className="text-teal-600" /> Add Room
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Room Type</label>
                <div className="relative">
                  <select value={modalType} onChange={e => setModalType(e.target.value as RoomType)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-teal-400 pr-8">
                    {ROOM_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Room Name</label>
                <input type="text" value={modalName} onChange={e => setModalName(e.target.value)}
                  placeholder="e.g. Master Bedroom…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-teal-400"
                  autoFocus onKeyDown={e => e.key === 'Enter' && confirmRoom()} />
              </div>
              <div className="flex items-center gap-1.5 text-xs bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-teal-700">
                <Info size={12} className="flex-shrink-0" />
                {drawingPoints.length} corner points · Zone will be calculated from centroid
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={cancelDraw}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button onClick={confirmRoom}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2.5 z-50 transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Footer credit */}
      <footer className="bg-slate-900 text-slate-400 text-[10px] text-center py-1.5 flex-shrink-0">
        made by RavMon
      </footer>
    </div>
  );
}

// Point-in-polygon check (Ray casting)
function isPointInPoly(pt: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > pt.y) !== (yj > pt.y) &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
