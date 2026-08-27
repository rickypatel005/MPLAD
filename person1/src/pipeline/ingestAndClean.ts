/**
 * Phase 1 & 2: Ingest, Profile, Clean, and Normalize Source CSV
 */
import { MASTER_STATES } from '../data/masterLocations.ts';
import { ConstituencyEntity, DistrictEntity, MPEntity, StateEntity } from '../types.ts';

export interface RawCsvRecord {
  srNo: string;
  state: string;
  mpName: string;
  constituency: string;
  allocatedAmount: string;
  rawRow: number;
}

export interface CleanedMasterDataset {
  states: StateEntity[];
  districts: DistrictEntity[];
  constituencies: ConstituencyEntity[];
  mps: MPEntity[];
  grandTotalRow: RawCsvRecord | null;
  missingAmountRecords: { row: number; mpName: string; constituency: string; state: string }[];
  qualityIssuesCount: number;
}

export function parseRawCsvText(csvText: string): RawCsvRecord[] {
  const lines = csvText.trim().split('\n');
  const records: RawCsvRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV handling quotes
    const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      matches.push(match[1] !== undefined ? match[1] : match[2]);
    }

    if (matches.length >= 5) {
      records.push({
        srNo: matches[0]?.trim() || '',
        state: matches[1]?.trim() || '',
        mpName: matches[2]?.trim() || '',
        constituency: matches[3]?.trim() || '',
        allocatedAmount: matches[4]?.trim() || '',
        rawRow: i + 1,
      });
    }
  }

  return records;
}

export function cleanAndNormalizeMasterData(records: RawCsvRecord[]): CleanedMasterDataset {
  const statesMap = new Map<string, StateEntity>();
  MASTER_STATES.forEach((s) => statesMap.set(s.name.toUpperCase(), s));

  const districts: DistrictEntity[] = [];
  const constituencies: ConstituencyEntity[] = [];
  const mps: MPEntity[] = [];
  const missingAmountRecords: { row: number; mpName: string; constituency: string; state: string }[] = [];
  let grandTotalRow: RawCsvRecord | null = null;

  const districtIdMap = new Map<string, string>();
  const constituencyIdMap = new Map<string, string>();
  let districtCounter = 1;
  let constituencyCounter = 1;
  let mpCounter = 1;

  for (const record of records) {
    // 1. Check for Grand Total row
    if (
      record.srNo === '544' ||
      record.state.toUpperCase().includes('GRAND TOTAL') ||
      record.mpName === '--' ||
      record.constituency === '--'
    ) {
      grandTotalRow = record;
      continue; // Exclude Grand Total from operational records
    }

    const stateUpper = record.state.toUpperCase();
    const stateEntity = statesMap.get(stateUpper) || MASTER_STATES.find(s => s.name === stateUpper) || {
      state_id: `ST${String(statesMap.size + 1).padStart(2, '0')}`,
      name: record.state,
      normalized_name: record.state,
      state_type: 'STATE' as const,
      total_mps: 1,
      total_allocated: 50000000,
      latitude: 20.5937,
      longitude: 78.9629,
    };

    // Normalize Constituency
    const constNorm = record.constituency
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    // Normalize District (approximate from constituency)
    const distKey = `${stateEntity.state_id}_${constNorm.toUpperCase()}`;
    let districtId = districtIdMap.get(distKey);
    if (!districtId) {
      districtId = `D${String(districtCounter++).padStart(3, '0')}`;
      districtIdMap.set(distKey, districtId);
      districts.push({
        district_id: districtId,
        state_id: stateEntity.state_id,
        name: record.constituency,
        normalized_name: constNorm,
      });
    }

    // Constituency Entity
    const constKey = `${stateEntity.state_id}_${record.constituency.toUpperCase()}_${constituencyCounter}`;
    let constId = constituencyIdMap.get(constKey);
    if (!constId) {
      constId = `C${String(constituencyCounter++).padStart(3, '0')}`;
      constituencyIdMap.set(constKey, constId);
      constituencies.push({
        constituency_id: constId,
        state_id: stateEntity.state_id,
        district_id: districtId,
        name: record.constituency,
        normalized_name: constNorm,
      });
    }

    // Normalize MP Name
    const mpNorm = record.mpName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    // Parse Amount
    const cleanAmountStr = record.allocatedAmount.replace(/[^0-9.]/g, '');
    let allocatedAmount: number | null = null;
    let qualityFlag: string | undefined = undefined;

    if (!cleanAmountStr || cleanAmountStr === '0') {
      allocatedAmount = null;
      qualityFlag = 'MISSING_SOURCE_VALUE';
      missingAmountRecords.push({
        row: record.rawRow,
        mpName: record.mpName,
        constituency: record.constituency,
        state: record.state,
      });
    } else {
      allocatedAmount = parseFloat(cleanAmountStr);
    }

    const mpId = `MP${String(mpCounter++).padStart(3, '0')}`;
    mps.push({
      mp_id: mpId,
      constituency_id: constId,
      state_id: stateEntity.state_id,
      name: record.mpName,
      normalized_name: mpNorm,
      allocated_amount: allocatedAmount,
      allocation_quality_flag: qualityFlag,
      source_row: record.rawRow,
    });
  }

  return {
    states: MASTER_STATES,
    districts,
    constituencies,
    mps,
    grandTotalRow,
    missingAmountRecords,
    qualityIssuesCount: missingAmountRecords.length + (grandTotalRow ? 1 : 0),
  };
}
