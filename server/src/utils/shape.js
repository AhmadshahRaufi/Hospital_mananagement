// The original Mongoose schemas nested a few fields (Patient.tpa, User.bankDetails,
// Setting.zoom) and computed a virtual (Medicine.availableQty). Postgres/Prisma
// models store these as flat columns / related rows, so we reassemble the same
// shape here before sending JSON back to the (unmodified) React client.

export function shapePatient(p) {
  if (!p) return p;
  const { tpaIsTPA, tpaProvider, tpaId, tpaValidity, ...rest } = p;
  return {
    ...rest,
    tpa: {
      isTPA: tpaIsTPA,
      provider: tpaProvider,
      tpaId,
      validity: tpaValidity,
    },
  };
}

export function shapeUser(u) {
  if (!u) return u;
  const { passwordHash, bankName, accountNumber, branch, ...rest } = u;
  return {
    ...rest,
    bankDetails: { bankName, accountNumber, branch },
  };
}

export function shapeSetting(s) {
  if (!s) return s;
  const { zoomAccountEmail, zoomApiKey, zoomApiSecret, zoomAccessToken, zoomConnected, ...rest } = s;
  return {
    ...rest,
    zoom: {
      accountEmail: zoomAccountEmail,
      apiKey: zoomApiKey,
      apiSecret: zoomApiSecret,
      accessToken: zoomAccessToken,
      connected: zoomConnected,
    },
  };
}

export function medicineAvailableQty(medicine) {
  return (medicine.batches || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
}

export function shapeMedicine(m) {
  if (!m) return m;
  return { ...m, availableQty: medicineAvailableQty(m) };
}
