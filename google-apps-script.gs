const SHEET_NAME = "Attendance";
const HEADERS = ["Name", "Table", "Attended", "VerifiedAt", "Source"];
const FORCE_DUPLICATE_NAMES = [
  "Sia Alvin Wong & Partners",
  "Thai Advocates",
  "S.K Ling & Tan Advocates",
  "NAIM",
  "Tang & Partners",
].map(function (name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
});

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || "status";

  if (action !== "status") {
    return output_({ ok: false, error: "Unsupported action." }, params.callback);
  }

  const guestName = normalizeName_(params.name);
  if (!guestName) {
    return output_({ ok: false, configured: true, attended: false, error: "Missing guest name." }, params.callback);
  }

  const sheet = ensureAttendanceSheet_();
  const rowNumber = findGuestRow_(sheet, guestName);

  if (!rowNumber) {
    return output_(
      {
        ok: true,
        configured: true,
        attended: false,
        name: params.name || "",
        table: "",
        verifiedAt: "",
      },
      params.callback
    );
  }

  const rowValues = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  return output_(
    {
      ok: true,
      configured: true,
      attended: normalizeName_(rowValues[2]) === "yes",
      name: rowValues[0] || "",
      table: rowValues[1] || "",
      verifiedAt: rowValues[3] || "",
    },
    params.callback
  );
}

function doPost(e) {
  const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  const action = payload.action || "checkin";

  if (action !== "checkin") {
    return output_({ ok: false, error: "Unsupported action." });
  }

  const guestName = normalizeName_(payload.name);
  if (!guestName) {
    return output_({ ok: false, error: "Missing guest name." });
  }

  const sheet = ensureAttendanceSheet_();
  const rowNumber = findGuestRow_(sheet, guestName);
  const shouldAppendDuplicate = shouldAppendDuplicate_(guestName);
  const rowValues = [
    String(payload.name || "").trim(),
    String(payload.table || "").trim(),
    "Yes",
    String(payload.verifiedAt || new Date().toISOString()).trim(),
    String(payload.source || "seat-finder-web").trim(),
  ];

  if (shouldAppendDuplicate || !rowNumber) {
    sheet.appendRow(rowValues);
  } else {
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([rowValues]);
  }

  return output_({
    ok: true,
    configured: true,
    attended: true,
    name: rowValues[0],
    table: rowValues[1],
    verifiedAt: rowValues[3],
  });
}

function shouldAppendDuplicate_(guestName) {
  return FORCE_DUPLICATE_NAMES.indexOf(guestName) >= 0;
}

function ensureAttendanceSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const headerValues = headerRange.getValues()[0];
  const needsHeader = HEADERS.some(function (header, index) {
    return headerValues[index] !== header;
  });

  if (needsHeader) {
    headerRange.setValues([HEADERS]);
  }

  return sheet;
}

function findGuestRow_(sheet, guestName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var index = 0; index < names.length; index += 1) {
    if (normalizeName_(names[index][0]) === guestName) {
      return index + 2;
    }
  }

  return 0;
}

function normalizeName_(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function output_(payload, callbackName) {
  var json = JSON.stringify(payload);
  if (callbackName) {
    return ContentService.createTextOutput(callbackName + "(" + json + ");").setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
  }

  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
