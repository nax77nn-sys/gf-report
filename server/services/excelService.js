const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const DAY_NAMES = [
  'Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'
];

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Genera il foglio Excel dettagliato per un singolo dipendente
 */
async function generateEmployeeExcel(user, timesheet, year, month) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GF REPORT';
  workbook.created = new Date();

  const monthName = MONTH_NAMES[month - 1];
  const sheetName = `${user.surname}_${monthName}_${year}`.substring(0, 31);
  const worksheet = workbook.addWorksheet(sheetName);

  // Stili colori
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' } // Blu scuro GF REPORT
  };

  const weekendFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' } // Grigio chiaro riposo
  };

  const totalFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' } // Grigio medio
  };

  // Titolo e Anagrafica
  worksheet.mergeCells('A1:K1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `GF REPORT - FOGLIO PRESENZE E RIMBORSI - ${monthName.toUpperCase()} ${year}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = headerFill;
  worksheet.getRow(1).height = 40;

  // Embedding Logo se presente
  const logoPath = path.join(__dirname, '..', '..', 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      const imageId = workbook.addImage({
        filename: logoPath,
        extension: 'png',
      });
      worksheet.addImage(imageId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 44, height: 44 }
      });
    } catch (e) {
      console.error('Errore embedding logo Excel:', e);
    }
  }

  worksheet.mergeCells('A2:E2');
  worksheet.getCell('A2').value = `Dipendente: ${user.surname} ${user.name}`;
  worksheet.getCell('A2').font = { bold: true, size: 11 };

  worksheet.mergeCells('F2:K2');
  worksheet.getCell('F2').value = `Email: ${user.email}   |   Stato: ${timesheet && timesheet.isLocked ? 'CONFERMATO / BLOCCATO' : 'IN COMPILAZIONE'}`;
  worksheet.getCell('F2').font = { italic: true, size: 11 };
  worksheet.getRow(2).height = 25;

  // Intestazione Colonne Tabella
  const headers = [
    'Giorno',
    'Data',
    'Giorno Sett.',
    'Ore Ordinarie',
    'Ore Straordinarie',
    'Ore Viaggio',
    'Ore Ferie',
    'Ore Malattia',
    'Reperibilità',
    'Rimborsi Spese (€)',
    'Dettaglio Spese / Note'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  const numDays = getDaysInMonth(year, month);
  const daysData = (timesheet && timesheet.days) || {};

  let startRow = 4;
  for (let d = 1; d <= numDays; d++) {
    const currentDate = new Date(year, month - 1, d);
    const dayOfWeekIndex = currentDate.getDay();
    const dayOfWeekName = DAY_NAMES[dayOfWeekIndex];
    const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;

    const dayInfo = daysData[d] || {};
    const ord = parseFloat(dayInfo.ordinaryHours) || 0;
    const str = parseFloat(dayInfo.overtimeHours) || 0;
    const viag = parseFloat(dayInfo.travelHours) || 0;
    const ferie = parseFloat(dayInfo.ferieHours) || 0;
    const mal = parseFloat(dayInfo.malattiaHours) || 0;
    const rep = dayInfo.onCall ? 'Sì' : '';
    
    // Spese
    let totalExpenseDay = 0;
    let descSpese = [];
    if (Array.isArray(dayInfo.expenses)) {
      dayInfo.expenses.forEach(e => {
        const val = parseFloat(e.amount) || 0;
        totalExpenseDay += val;
        if (e.description) descSpese.push(`${e.description} (€${val.toFixed(2)})`);
      });
    } else if (dayInfo.expenseAmount) {
      totalExpenseDay = parseFloat(dayInfo.expenseAmount) || 0;
      if (dayInfo.expenseDescription) descSpese.push(dayInfo.expenseDescription);
    }

    if (dayInfo.notes) {
      descSpese.push(`Note: ${dayInfo.notes}`);
    }

    const formattedDate = `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

    const row = worksheet.addRow([
      d,
      formattedDate,
      dayOfWeekName,
      ord > 0 ? ord : '',
      str > 0 ? str : '',
      viag > 0 ? viag : '',
      ferie > 0 ? ferie : '',
      mal > 0 ? mal : '',
      rep,
      totalExpenseDay > 0 ? totalExpenseDay : '',
      descSpese.join('; ')
    ]);

    // Stile della riga
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      if (isWeekend) {
        cell.fill = weekendFill;
      }

      if ([1, 2, 3, 9].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([4, 5, 6, 7, 8].includes(colNumber)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '0.0';
        }
      } else if (colNumber === 10) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '€ #,##0.00';
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  }

  const endRow = startRow + numDays - 1;

  // Riga Totali
  const totalRowIndex = endRow + 1;
  const totalRow = worksheet.addRow([
    'TOTALI',
    '',
    '',
    { formula: `SUM(D${startRow}:D${endRow})` },
    { formula: `SUM(E${startRow}:E${endRow})` },
    { formula: `SUM(F${startRow}:F${endRow})` },
    { formula: `SUM(G${startRow}:G${endRow})` },
    { formula: `SUM(H${startRow}:H${endRow})` },
    { formula: `COUNTIF(I${startRow}:I${endRow}, "Sì")` },
    { formula: `SUM(J${startRow}:J${endRow})` },
    ''
  ]);

  totalRow.height = 25;
  worksheet.mergeCells(`A${totalRowIndex}:C${totalRowIndex}`);
  totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.fill = totalFill;
    cell.border = {
      top: { style: 'medium' },
      left: { style: 'thin' },
      bottom: { style: 'double' },
      right: { style: 'thin' }
    };
    if ([4, 5, 6, 7, 8].includes(colNumber)) {
      cell.numFmt = '0.0';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber === 10) {
      cell.numFmt = '€ #,##0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber === 9) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // Sezione Reperibilità (Settimane dal... al...)
  let currentY = totalRowIndex + 2;
  if (timesheet && timesheet.onCallWeeks && timesheet.onCallWeeks.length > 0) {
    worksheet.mergeCells(`A${currentY}:K${currentY}`);
    const repHeader = worksheet.getCell(`A${currentY}`);
    repHeader.value = 'DETTAGLIO SETTIMANE DI REPERIBILITÀ:';
    repHeader.font = { bold: true, color: { argb: 'FF1E3A8A' } };
    currentY++;

    timesheet.onCallWeeks.forEach((w, idx) => {
      worksheet.mergeCells(`A${currentY}:K${currentY}`);
      const rowW = worksheet.getCell(`A${currentY}`);
      rowW.value = `• Periodo ${idx + 1}: dal ${w.startDate || '-'} al ${w.endDate || '-'} ${w.notes ? ' (' + w.notes + ')' : ''}`;
      rowW.font = { italic: true };
      currentY++;
    });
    currentY++;
  }

  // Spazio Firme
  currentY += 1;
  worksheet.mergeCells(`B${currentY}:D${currentY}`);
  worksheet.getCell(`B${currentY}`).value = 'Firma del Dipendente';
  worksheet.getCell(`B${currentY}`).font = { bold: true };
  worksheet.getCell(`B${currentY}`).alignment = { horizontal: 'center' };

  worksheet.mergeCells(`H${currentY}:J${currentY}`);
  worksheet.getCell(`H${currentY}`).value = 'Firma Datore di Lavoro per Approvazione';
  worksheet.getCell(`H${currentY}`).font = { bold: true };
  worksheet.getCell(`H${currentY}`).alignment = { horizontal: 'center' };

  currentY += 2;
  worksheet.mergeCells(`B${currentY}:D${currentY}`);
  worksheet.getCell(`B${currentY}`).border = { bottom: { style: 'thin' } };

  worksheet.mergeCells(`H${currentY}:J${currentY}`);
  worksheet.getCell(`H${currentY}`).border = { bottom: { style: 'thin' } };

  // Larghezza Colonne
  worksheet.columns = [
    { width: 8 },  // Giorno
    { width: 13 }, // Data
    { width: 14 }, // Giorno Sett.
    { width: 15 }, // Ore Ordinarie
    { width: 18 }, // Ore Straordinarie
    { width: 14 }, // Ore Viaggio
    { width: 14 }, // Ore Ferie
    { width: 14 }, // Ore Malattia
    { width: 14 }, // Reperibilità
    { width: 20 }, // Rimborsi Spese
    { width: 35 }  // Note / Dettaglio
  ];

  return workbook;
}

/**
 * Genera il report cumulativo aziendale per tutti i dipendenti in un unico file Excel
 */
async function generateCompanyExcel(employees, timesheetsMap, year, month) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GF REPORT';
  workbook.created = new Date();

  const monthName = MONTH_NAMES[month - 1];

  // Foglio Riepilogo Globale
  const summarySheet = workbook.addWorksheet('Riepilogo Dipendenti');

  summarySheet.mergeCells('A1:J1');
  const title = summarySheet.getCell('A1');
  title.value = `GF REPORT - RIEPILOGO MENSILE AZIENDALE - ${monthName.toUpperCase()} ${year}`;
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  summarySheet.getRow(1).height = 40;

  // Embedding Logo in riepilogo aziendale
  const logoPath = path.join(__dirname, '..', '..', 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      const imageId = workbook.addImage({
        filename: logoPath,
        extension: 'png',
      });
      summarySheet.addImage(imageId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 44, height: 44 }
      });
    } catch (e) {
      console.error('Errore embedding logo Excel riepilogo:', e);
    }
  }

  const headers = [
    'Dipendente',
    'Email',
    'Ore Ordinarie',
    'Ore Straordinarie',
    'Ore Viaggio',
    'Ore Ferie',
    'Ore Malattia',
    'Giorni Reperibilità',
    'Totale Rimborsi (€)',
    'Stato'
  ];

  const headerRow = summarySheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  let rowIdx = 3;
  employees.forEach(emp => {
    const ts = timesheetsMap[emp.id];
    let ord = 0;
    let str = 0;
    let viag = 0;
    let ferie = 0;
    let mal = 0;
    let repDays = 0;
    let spese = 0;

    if (ts && ts.days) {
      Object.values(ts.days).forEach(d => {
        ord += parseFloat(d.ordinaryHours) || 0;
        str += parseFloat(d.overtimeHours) || 0;
        viag += parseFloat(d.travelHours) || 0;
        ferie += parseFloat(d.ferieHours) || 0;
        mal += parseFloat(d.malattiaHours) || 0;
        if (d.onCall) repDays++;
        if (Array.isArray(d.expenses)) {
          d.expenses.forEach(e => {
            spese += parseFloat(e.amount) || 0;
          });
        } else if (d.expenseAmount) {
          spese += parseFloat(d.expenseAmount) || 0;
        }
      });
    }

    const row = summarySheet.addRow([
      `${emp.surname} ${emp.name}`,
      emp.email,
      ord,
      str,
      viag,
      ferie,
      mal,
      repDays,
      spese,
      ts && ts.isLocked ? 'Confermato' : 'In compilazione'
    ]);

    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if ([3, 4, 5, 6, 7].includes(colNumber)) {
        cell.numFmt = '0.0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 8) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNumber === 9) {
        cell.numFmt = '€ #,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 10) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    rowIdx++;
  });

  // Totali Generali
  const totalRow = summarySheet.addRow([
    'TOTALE COMPLESSIVO AZIENDA',
    '',
    { formula: `SUM(C3:C${rowIdx - 1})` },
    { formula: `SUM(D3:D${rowIdx - 1})` },
    { formula: `SUM(E3:E${rowIdx - 1})` },
    { formula: `SUM(F3:F${rowIdx - 1})` },
    { formula: `SUM(G3:G${rowIdx - 1})` },
    { formula: `SUM(H3:H${rowIdx - 1})` },
    { formula: `SUM(I3:I${rowIdx - 1})` },
    ''
  ]);

  totalRow.height = 26;
  summarySheet.mergeCells(`A${rowIdx}:B${rowIdx}`);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    cell.border = {
      top: { style: 'medium' },
      left: { style: 'thin' },
      bottom: { style: 'double' },
      right: { style: 'thin' }
    };
    if ([3, 4, 5, 6, 7].includes(colNumber)) {
      cell.numFmt = '0.0';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber === 9) {
      cell.numFmt = '€ #,##0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber === 8) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  summarySheet.columns = [
    { width: 24 }, // Dipendente
    { width: 28 }, // Email
    { width: 16 }, // Ordinarie
    { width: 18 }, // Straordinarie
    { width: 16 }, // Viaggio
    { width: 14 }, // Ferie
    { width: 14 }, // Malattia
    { width: 18 }, // Reperibilità
    { width: 20 }, // Rimborsi
    { width: 18 }  // Stato
  ];

  return workbook;
}

module.exports = {
  generateEmployeeExcel,
  generateCompanyExcel
};
