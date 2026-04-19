import { useEffect, useMemo, useState } from "react";

const loadData = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveData = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const toNumber = (value) => {
  const n = Number(String(value || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const money = (value) =>
  toNumber(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

const todayFr = () => new Date().toLocaleDateString("fr-FR");

const inventoryTypeDefaults = {
  Lampe: ["Rond blanc", "Rond couleurs", "Simple blanc", "Simple couleurs"],
  Horloge: ["Murale", "Sur support"],
  Cadre: ["Petit", "Moyen", "Grand"],
  "Porte clef": ["Simple"],
};

function App() {
  const [page, setPage] = useState("home");
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inventoryPreviewOpen, setInventoryPreviewOpen] = useState(false);
  const [lastInventoryPreviewOpen, setLastInventoryPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [settings, setSettings] = useState(() =>
    loadData("stock3d_settings_v2", {
      companyName: "CREATION 3D",
      email: "",
      tva: 20,
      version: "2.0",
    })
  );

  const [filaments, setFilaments] = useState(() =>
    loadData("stock3d_filaments_v2_full", [])
  );

  const [materials, setMaterials] = useState(() =>
    loadData("stock3d_materials_v2_full", [])
  );

  const [inventoryDraft, setInventoryDraft] = useState(() =>
    loadData("stock3d_inventory_draft_v2_full", [])
  );

  const [inventoryHistory, setInventoryHistory] = useState(() =>
    loadData("stock3d_inventory_history_v2_full", [])
  );

  const [inventoryTypes, setInventoryTypes] = useState(() =>
    loadData("stock3d_inventory_types_v2_full", inventoryTypeDefaults)
  );

  const [filamentForm, setFilamentForm] = useState({
    brand: "",
    filamentType: "",
    color: "",
    quantity: "",
    price: "",
    minimum: "",
  });

  const [materialForm, setMaterialForm] = useState({
    category: "",
    type: "",
    quantity: "",
    price: "",
    minimum: "",
  });

  const [inventoryForm, setInventoryForm] = useState({
    category: "",
    type: "",
    quantity: "",
    price: "",
    categoryOther: "",
    typeOther: "",
  });

  const [movementForm, setMovementForm] = useState({
    movementType: "Entrée",
    stockType: "Filament",
    code: "",
    brand: "",
    filamentType: "",
    color: "",
    category: "",
    type: "",
    quantity: "",
    price: "",
  });

  useEffect(() => saveData("stock3d_settings_v2", settings), [settings]);
  useEffect(() => saveData("stock3d_filaments_v2_full", filaments), [filaments]);
  useEffect(() => saveData("stock3d_materials_v2_full", materials), [materials]);
  useEffect(() => saveData("stock3d_inventory_draft_v2_full", inventoryDraft), [inventoryDraft]);
  useEffect(() => saveData("stock3d_inventory_history_v2_full", inventoryHistory), [inventoryHistory]);
  useEffect(() => saveData("stock3d_inventory_types_v2_full", inventoryTypes), [inventoryTypes]);

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2200);
  };

  const totalFilamentValue = useMemo(
    () =>
      filaments.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
        0
      ),
    [filaments]
  );

  const totalMaterialValue = useMemo(
    () =>
      materials.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
        0
      ),
    [materials]
  );

  const totalStockValue = totalFilamentValue + totalMaterialValue;

  const draftTTC = useMemo(
    () =>
      inventoryDraft.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
        0
      ),
    [inventoryDraft]
  );

  const draftHT = useMemo(
    () => draftTTC / (1 + toNumber(settings.tva) / 100),
    [draftTTC, settings.tva]
  );

  const lastInventory = inventoryHistory[0] || null;
  const last3Inventories = inventoryHistory.slice(0, 3);

  const lowFilaments = filaments.filter(
    (i) => toNumber(i.minimum) > 0 && toNumber(i.quantity) > 0 && toNumber(i.quantity) <= toNumber(i.minimum)
  );
  const lowMaterials = materials.filter(
    (i) => toNumber(i.minimum) > 0 && toNumber(i.quantity) > 0 && toNumber(i.quantity) <= toNumber(i.minimum)
  );

  const ruptureFilaments = filaments.filter((i) => toNumber(i.quantity) <= 0);
  const ruptureMaterials = materials.filter((i) => toNumber(i.quantity) <= 0);

  const openPrintWindow = (title, items, ttc, ht) => {
    const rows = items
      .map(
        (item) => `
          <tr>
            <td>${item.category || item.brand || "-"}</td>
            <td>${item.type || item.filamentType || "-"}</td>
            <td>${item.color || "-"}</td>
            <td>${item.quantity}</td>
            <td>${money(item.price)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
            h1 { margin: 0 0 12px; }
            .meta { margin-bottom: 12px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #d9d9d9; padding: 8px; text-align: left; }
            th { background: #f4f4f4; }
            .totals { margin-top: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Date d'impression : ${todayFr()}</div>
          <div class="meta">Entreprise : ${settings.companyName || "-"}</div>
          <div class="meta">Nombre de produits : ${items.length}</div>
          <table>
            <thead>
              <tr>
                <th>Catégorie / Marque</th>
                <th>Type</th>
                <th>Couleur</th>
                <th>Quantité</th>
                <th>Prix</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">TTC : ${money(ttc)}</div>
          <div class="totals">HT : ${money(ht)}</div>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const sendByEmail = (title, items, ttc, ht) => {
    if (!settings.email.trim()) {
      showMessage("Ajoute une adresse mail dans Paramètres");
      return;
    }
    const lines = items.map(
      (item) =>
        `- ${item.category || item.brand || "-"} | ${item.type || item.filamentType || "-"} | ${item.color || "-"} | Qté: ${item.quantity} | Prix: ${money(item.price)}`
    );
    const body = [
      title,
      `Date : ${todayFr()}`,
      `Entreprise : ${settings.companyName || "-"}`,
      `Nombre de produits : ${items.length}`,
      "",
      ...lines,
      "",
      `TTC : ${money(ttc)}`,
      `HT : ${money(ht)}`,
    ].join("\n");

    window.location.href = `mailto:${settings.email}?subject=${encodeURIComponent(
      title
    )}&body=${encodeURIComponent(body)}`;
  };

  const resetInventoryForm = () => {
    setInventoryForm({
      category: "",
      type: "",
      quantity: "",
      price: "",
      categoryOther: "",
      typeOther: "",
    });
  };

  const addFilament = () => {
    if (
      !filamentForm.brand.trim() ||
      !filamentForm.filamentType.trim() ||
      !filamentForm.color.trim() ||
      !filamentForm.quantity.trim() ||
      !filamentForm.price.trim()
    ) {
      showMessage("Complète tous les champs filament");
      return;
    }

    const item = {
      id: Date.now(),
      brand: filamentForm.brand.trim(),
      filamentType: filamentForm.filamentType.trim(),
      color: filamentForm.color.trim(),
      quantity: toNumber(filamentForm.quantity),
      price: toNumber(filamentForm.price),
      minimum: toNumber(filamentForm.minimum),
      code: "FIL-" + Math.floor(1000 + Math.random() * 9000),
    };

    setFilaments((prev) => [item, ...prev]);
    setFilamentForm({
      brand: "",
      filamentType: "",
      color: "",
      quantity: "",
      price: "",
      minimum: "",
    });
    showMessage("Filament ajouté");
  };

  const addMaterial = () => {
    if (
      !materialForm.category.trim() ||
      !materialForm.quantity.trim() ||
      !materialForm.price.trim()
    ) {
      showMessage("Complète catégorie, quantité et prix");
      return;
    }

    const item = {
      id: Date.now(),
      category: materialForm.category.trim(),
      type: materialForm.type.trim(),
      quantity: toNumber(materialForm.quantity),
      price: toNumber(materialForm.price),
      minimum: toNumber(materialForm.minimum),
    };

    setMaterials((prev) => [item, ...prev]);
    setMaterialForm({
      category: "",
      type: "",
      quantity: "",
      price: "",
      minimum: "",
    });
    showMessage("Matière première ajoutée");
  };

  const addInventoryProduct = () => {
    const finalCategory =
      inventoryForm.category === "Autre produit"
        ? inventoryForm.categoryOther.trim()
        : inventoryForm.category.trim();

    const finalType =
      inventoryForm.type === "Autre produit"
        ? inventoryForm.typeOther.trim()
        : inventoryForm.type.trim();

    if (!finalCategory || !inventoryForm.quantity.trim() || !inventoryForm.price.trim()) {
      showMessage("Complète catégorie, quantité et prix");
      return;
    }

    const item = {
      id: Date.now(),
      category: finalCategory,
      type: finalType,
      quantity: toNumber(inventoryForm.quantity),
      price: toNumber(inventoryForm.price),
    };

    if (
      inventoryForm.category === "Autre produit" &&
      finalCategory &&
      !inventoryTypes[finalCategory]
    ) {
      setInventoryTypes((prev) => ({ ...prev, [finalCategory]: [] }));
    }

    if (
      finalCategory &&
      finalType &&
      !["Autre produit", ""].includes(inventoryForm.type)
    ) {
      setInventoryTypes((prev) => {
        const existing = prev[finalCategory] || [];
        return existing.includes(finalType)
          ? prev
          : { ...prev, [finalCategory]: [...existing, finalType] };
      });
    }

    setInventoryDraft((prev) => [item, ...prev]);
    resetInventoryForm();
    showMessage("Produit ajouté à l’inventaire");
  };

  const validateInventory = () => {
    if (inventoryDraft.length === 0) {
      showMessage("Aucun produit dans l’inventaire");
      return;
    }

    const ttc = inventoryDraft.reduce(
      (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
      0
    );
    const ht = ttc / (1 + toNumber(settings.tva) / 100);

    const entry = {
      id: Date.now(),
      date: todayFr(),
      ttc,
      ht,
      items: inventoryDraft,
    };

    setInventoryHistory((prev) => [entry, ...prev].slice(0, 3));
    setInventoryDraft([]);
    setPage("home");
    showMessage("Inventaire validé");
  };

  const simulateScan = () => {
    const sampleCode = "SIM-" + Math.floor(1000 + Math.random() * 9000);

    if (movementForm.stockType !== "Filament") {
      setMovementForm((prev) => ({ ...prev, code: sampleCode }));
      showMessage("Code scanné : " + sampleCode);
      return;
    }

    if (filaments.length > 0) {
      const randomItem = filaments[Math.floor(Math.random() * filaments.length)];

      setMovementForm((prev) => ({
        ...prev,
        code: randomItem.code || sampleCode,
        brand: randomItem.brand || "",
        filamentType: randomItem.filamentType || "",
        color: randomItem.color || "",
        price:
          prev.movementType === "Entrée"
            ? String(randomItem.price || "")
            : prev.price,
      }));

      showMessage("Scan simulé effectué");
    } else {
      setMovementForm((prev) => ({
        ...prev,
        code: sampleCode,
      }));
      showMessage("Code scanné : " + sampleCode);
    }
  };

  const handleMovement = () => {
    const qty = toNumber(movementForm.quantity);
    if (!qty) {
      showMessage("Quantité invalide");
      return;
    }

    if (movementForm.stockType === "Filament") {
      if (
        !movementForm.brand.trim() ||
        !movementForm.filamentType.trim() ||
        !movementForm.color.trim()
      ) {
        showMessage("Complète marque, type et couleur");
        return;
      }

      const matchIndex = filaments.findIndex(
        (item) =>
          item.brand === movementForm.brand.trim() &&
          item.filamentType === movementForm.filamentType.trim() &&
          item.color === movementForm.color.trim()
      );

      if (movementForm.movementType === "Entrée") {
        if (matchIndex >= 0) {
          const updated = [...filaments];
          updated[matchIndex] = {
            ...updated[matchIndex],
            quantity: toNumber(updated[matchIndex].quantity) + qty,
            price: movementForm.price.trim()
              ? toNumber(movementForm.price)
              : updated[matchIndex].price,
          };
          setFilaments(updated);
        } else {
          if (!movementForm.price.trim()) {
            showMessage("Ajoute un prix pour une nouvelle entrée");
            return;
          }
          setFilaments((prev) => [
            {
              id: Date.now(),
              brand: movementForm.brand.trim(),
              filamentType: movementForm.filamentType.trim(),
              color: movementForm.color.trim(),
              quantity: qty,
              price: toNumber(movementForm.price),
              minimum: 0,
              code: movementForm.code || "FIL-" + Math.floor(1000 + Math.random() * 9000),
            },
            ...prev,
          ]);
        }
        showMessage("Entrée filament enregistrée");
      } else {
        if (matchIndex < 0) {
          showMessage("Filament introuvable");
          return;
        }
        const updated = [...filaments];
        updated[matchIndex] = {
          ...updated[matchIndex],
          quantity: Math.max(0, toNumber(updated[matchIndex].quantity) - qty),
        };
        setFilaments(updated);
        showMessage("Sortie filament enregistrée");
      }
    }

    if (movementForm.stockType === "Matière première") {
      if (!movementForm.category.trim()) {
        showMessage("Complète la catégorie");
        return;
      }

      const matchIndex = materials.findIndex(
        (item) =>
          item.category === movementForm.category.trim() &&
          item.type === movementForm.type.trim()
      );

      if (movementForm.movementType === "Entrée") {
        if (matchIndex >= 0) {
          const updated = [...materials];
          updated[matchIndex] = {
            ...updated[matchIndex],
            quantity: toNumber(updated[matchIndex].quantity) + qty,
            price: movementForm.price.trim()
              ? toNumber(movementForm.price)
              : updated[matchIndex].price,
          };
          setMaterials(updated);
        } else {
          if (!movementForm.price.trim()) {
            showMessage("Ajoute un prix pour une nouvelle entrée");
            return;
          }
          setMaterials((prev) => [
            {
              id: Date.now(),
              category: movementForm.category.trim(),
              type: movementForm.type.trim(),
              quantity: qty,
              price: toNumber(movementForm.price),
              minimum: 0,
            },
            ...prev,
          ]);
        }
        showMessage("Entrée matière première enregistrée");
      } else {
        if (matchIndex < 0) {
          showMessage("Produit introuvable");
          return;
        }
        const updated = [...materials];
        updated[matchIndex] = {
          ...updated[matchIndex],
          quantity: Math.max(0, toNumber(updated[matchIndex].quantity) - qty),
        };
        setMaterials(updated);
        showMessage("Sortie matière première enregistrée");
      }
    }

    setMovementForm((prev) => ({
      movementType: "Entrée",
      stockType: prev.stockType,
      code: "",
      brand: "",
      filamentType: "",
      color: "",
      category: "",
      type: "",
      quantity: "",
      price: "",
    }));
    setPage("home");
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.kind === "filament") {
      setFilaments((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      showMessage("Filament supprimé");
    }

    if (deleteTarget.kind === "material") {
      setMaterials((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      showMessage("Produit supprimé");
    }

    if (deleteTarget.kind === "inventoryDraft") {
      setInventoryDraft((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      showMessage("Produit retiré");
    }

    setDeleteTarget(null);
  };

  const cardClass = "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm";
  const buttonClass = "rounded-2xl px-4 py-3 font-medium shadow-sm";

  return (
    <div className="min-h-screen bg-[#f7f3ff] p-4 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-5">
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
              <h2 className="text-lg font-semibold">Confirmation</h2>
              <p className="mt-2 text-sm text-slate-600">
                Vous supprimez définitivement cet élément.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={confirmDelete}
                  className="flex-1 rounded-2xl bg-red-600 px-4 py-2 text-sm text-white"
                >
                  Valider
                </button>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Paramètres</h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Nom entreprise</label>
                  <input
                    className="w-full rounded-2xl border px-3 py-2"
                    value={settings.companyName}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, companyName: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-500">TVA (%)</label>
                  <input
                    className="w-full rounded-2xl border px-3 py-2"
                    value={settings.tva}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, tva: toNumber(e.target.value) }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-500">Email</label>
                  <input
                    className="w-full rounded-2xl border px-3 py-2"
                    value={settings.email}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>

                <div className="pt-2 text-center text-sm text-slate-400">
                  Version {settings.version}
                </div>
              </div>
            </div>
          </div>
        )}

        {inventoryPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Aperçu inventaire</h2>
                <button
                  onClick={() => setInventoryPreviewOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-3 text-sm text-slate-600">
                <div>Date : {todayFr()}</div>
                <div>Produits : {inventoryDraft.length}</div>
              </div>

              <div className="mt-4 space-y-2">
                {inventoryDraft.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between rounded-2xl border p-3 text-sm"
                  >
                    <span>
                      {item.category} · {item.type || "Aucun"}
                    </span>
                    <span>
                      {item.quantity} × {money(item.price)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 text-sm font-medium">
                <div>TTC : {money(draftTTC)}</div>
                <div>HT : {money(draftHT)}</div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => sendByEmail("Inventaire en cours", inventoryDraft, draftTTC, draftHT)}
                  className="flex-1 rounded-2xl border border-[#0f766e] bg-white py-2 text-sm text-[#0f766e]"
                >
                  ✉️ Envoyer par mail
                </button>
                <button
                  onClick={() => openPrintWindow("Inventaire en cours", inventoryDraft, draftTTC, draftHT)}
                  className="flex-1 rounded-2xl bg-[#0f766e] py-2 text-sm text-white"
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {lastInventoryPreviewOpen && lastInventory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Aperçu dernier inventaire</h2>
                <button
                  onClick={() => setLastInventoryPreviewOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-3 text-sm text-slate-600">
                <div>Date : {lastInventory.date}</div>
                <div>Produits : {lastInventory.items.length}</div>
              </div>

              <div className="mt-4 space-y-2">
                {lastInventory.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between rounded-2xl border p-3 text-sm"
                  >
                    <span>
                      {item.category} · {item.type || "Aucun"}
                    </span>
                    <span>
                      {item.quantity} × {money(item.price)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 text-sm font-medium">
                <div>TTC : {money(lastInventory.ttc)}</div>
                <div>HT : {money(lastInventory.ht)}</div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    sendByEmail(
                      "Dernier inventaire",
                      lastInventory.items,
                      lastInventory.ttc,
                      lastInventory.ht
                    )
                  }
                  className="flex-1 rounded-2xl border border-[#0f766e] bg-white py-2 text-sm text-[#0f766e]"
                >
                  ✉️ Envoyer par mail
                </button>
                <button
                  onClick={() =>
                    openPrintWindow(
                      "Dernier inventaire",
                      lastInventory.items,
                      lastInventory.ttc,
                      lastInventory.ht
                    )
                  }
                  className="flex-1 rounded-2xl bg-[#0f766e] py-2 text-sm text-white"
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs text-slate-500">Compte connecté</p>
              <h1 className="text-3xl font-bold text-slate-800">Stock 3D</h1>
              <button
                onClick={() => setSettingsOpen(true)}
                className="mt-3 rounded-2xl bg-[#dbeafe] px-4 py-2 text-sm text-[#1e3a8a]"
              >
                ⚙️ Paramètres
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-green-100 px-2 py-1 text-center text-green-700">PC ✔</div>
              <div className="rounded-xl bg-green-100 px-2 py-1 text-center text-green-700">Mac ✔</div>
              <div className="rounded-xl bg-green-100 px-2 py-1 text-center text-green-700">Tablette ✔</div>
            </div>
          </div>
        </header>

        {message && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {page === "home" && (
          <>
            <button
              onClick={() => setPage("movement")}
              className="w-full rounded-3xl bg-[#9f7aea] py-5 text-lg font-semibold text-white shadow-md"
            >
              🔄 Entrée / Sortie
            </button>

            <div className="grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
              <div className={`${cardClass} bg-[#bfdbfe] border-[#93c5fd]`}>
                <p className="text-sm text-slate-500">Stock total</p>
                <p className="mt-2 text-2xl font-semibold text-[#1e3a8a]">
                  {money(totalStockValue)}
                </p>
                <div className="mt-2 text-sm text-slate-500">
                  <div>Filament : {money(totalFilamentValue)}</div>
                  <div>Matière première : {money(totalMaterialValue)}</div>
                </div>
              </div>

              <div className={`${cardClass} bg-[#ccfbf1] border-[#99f6e4]`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-slate-500">Inventaire production</p>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                    À jour
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[0, 1, 2].map((i) => {
                    const entry = last3Inventories[i];
                    return (
                      <div key={i} className="rounded-xl bg-white px-2 py-2 text-center">
                        <p className="text-[10px] text-slate-400">Inventaire {i + 1}</p>
                        <p className="font-medium">{entry?.date || "—"}</p>
                        <p className="mt-1 text-slate-400">TTC</p>
                        <p className="font-medium">{entry ? money(entry.ttc) : "—"}</p>
                        <p className="mt-1 text-slate-400">HT</p>
                        <p className="font-medium">{entry ? money(entry.ht) : "—"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                onClick={() => setPage("filaments")}
                className={`${buttonClass} bg-[#bfdbfe] text-[#1e3a8a]`}
              >
                🧵 Filament
              </button>
              <button
                onClick={() => setPage("materials")}
                className={`${buttonClass} bg-[#bfdbfe] text-[#1e3a8a]`}
              >
                📦 Matière première
              </button>
              <button
                onClick={() => setPage("inventory")}
                className={`${buttonClass} bg-[#ccfbf1] text-[#0f766e]`}
              >
                📋 Inventaire
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-lg font-semibold text-orange-700">Stock bas</p>
                <div className="mt-2 text-sm text-orange-800">
                  <div>Filament : {lowFilaments.length}</div>
                  <div>Matière première : {lowMaterials.length}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-red-200 bg-red-50 p-4">
                <p className="text-lg font-semibold text-red-700">Rupture</p>
                <div className="mt-2 text-sm text-red-800">
                  <div>Filament : {ruptureFilaments.length}</div>
                  <div>Matière première : {ruptureMaterials.length}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {page === "filaments" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setPage("home")} className="rounded-2xl border bg-white px-3 py-2">
                ← Accueil
              </button>
              <h2 className="text-2xl font-semibold text-[#1e3a8a]">Filament</h2>
            </div>

            <div className={`${cardClass} bg-[#dbeafe] border-[#bfdbfe]`}>
              <h3 className="mb-3 text-lg font-semibold text-[#1e3a8a]">Ajouter un filament</h3>
              <div className="grid gap-3 md:grid-cols-6">
                <input className="rounded-2xl border px-3 py-2" placeholder="Marque" value={filamentForm.brand} onChange={(e) => setFilamentForm((p) => ({ ...p, brand: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Type" value={filamentForm.filamentType} onChange={(e) => setFilamentForm((p) => ({ ...p, filamentType: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Couleur" value={filamentForm.color} onChange={(e) => setFilamentForm((p) => ({ ...p, color: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Quantité" value={filamentForm.quantity} onChange={(e) => setFilamentForm((p) => ({ ...p, quantity: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Prix €" value={filamentForm.price} onChange={(e) => setFilamentForm((p) => ({ ...p, price: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Stock mini" value={filamentForm.minimum} onChange={(e) => setFilamentForm((p) => ({ ...p, minimum: e.target.value }))} />
              </div>
              <button onClick={addFilament} className="mt-3 rounded-2xl bg-[#1e3a8a] px-4 py-2 text-white">
                Valider
              </button>
            </div>

            {filaments.length === 0 ? (
              <div className={cardClass}>Aucun filament enregistré.</div>
            ) : (
              <div className={cardClass}>
                <div className="space-y-2">
                  {filaments.map((item) => (
                    <div key={item.id} className="grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-6">
                      <div>
                        <p className="text-xs text-slate-500">Marque</p>
                        <p className="font-medium">{item.brand}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Type</p>
                        <p className="font-medium">{item.filamentType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Couleur</p>
                        <p className="font-medium">{item.color}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Quantité</p>
                        <p className="font-medium">{item.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Prix</p>
                        <p className="font-medium">{money(item.price)}</p>
                      </div>
                      <div className="flex items-end justify-end">
                        <button onClick={() => setDeleteTarget({ kind: "filament", id: item.id })} className="rounded-xl bg-red-500 px-3 py-2 text-sm text-white">
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {page === "materials" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setPage("home")} className="rounded-2xl border bg-white px-3 py-2">
                ← Accueil
              </button>
              <h2 className="text-2xl font-semibold text-[#1e3a8a]">Matière première</h2>
            </div>

            <div className={`${cardClass} bg-[#dbeafe] border-[#bfdbfe]`}>
              <h3 className="mb-3 text-lg font-semibold text-[#1e3a8a]">Ajouter une matière première</h3>
              <div className="grid gap-3 md:grid-cols-5">
                <input className="rounded-2xl border px-3 py-2" placeholder="Catégorie" value={materialForm.category} onChange={(e) => setMaterialForm((p) => ({ ...p, category: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Type" value={materialForm.type} onChange={(e) => setMaterialForm((p) => ({ ...p, type: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Quantité" value={materialForm.quantity} onChange={(e) => setMaterialForm((p) => ({ ...p, quantity: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Prix €" value={materialForm.price} onChange={(e) => setMaterialForm((p) => ({ ...p, price: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Stock mini" value={materialForm.minimum} onChange={(e) => setMaterialForm((p) => ({ ...p, minimum: e.target.value }))} />
              </div>
              <button onClick={addMaterial} className="mt-3 rounded-2xl bg-[#1e3a8a] px-4 py-2 text-white">
                Valider
              </button>
            </div>

            {materials.length === 0 ? (
              <div className={cardClass}>Aucun produit enregistré.</div>
            ) : (
              <div className={cardClass}>
                <div className="space-y-2">
                  {materials.map((item) => (
                    <div key={item.id} className="grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-5">
                      <div>
                        <p className="text-xs text-slate-500">Catégorie</p>
                        <p className="font-medium">{item.category}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Type</p>
                        <p className="font-medium">{item.type || "Aucun"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Quantité</p>
                        <p className="font-medium">{item.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Prix</p>
                        <p className="font-medium">{money(item.price)}</p>
                      </div>
                      <div className="flex items-end justify-end">
                        <button onClick={() => setDeleteTarget({ kind: "material", id: item.id })} className="rounded-xl bg-red-500 px-3 py-2 text-sm text-white">
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {page === "inventory" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setPage("home")} className="rounded-2xl border bg-white px-3 py-2">
                ← Accueil
              </button>
              <h2 className="text-2xl font-semibold text-[#0f766e]">Inventaire</h2>
            </div>

            <div className={`${cardClass} bg-[#ccfbf1] border-[#99f6e4]`}>
              <h3 className="mb-3 text-lg font-semibold text-[#0f766e]">Inventaire production</h3>

              <div className="grid gap-3 md:grid-cols-4">
                <select className="rounded-2xl border px-3 py-2" value={inventoryForm.category} onChange={(e) => setInventoryForm((prev) => ({ ...prev, category: e.target.value, type: "" }))}>
                  <option value="">Catégorie</option>
                  {Object.keys(inventoryTypes).map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                  <option value="Autre produit">Autre produit</option>
                </select>

                <select className="rounded-2xl border px-3 py-2" value={inventoryForm.type} onChange={(e) => setInventoryForm((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="">Type</option>
                  {(inventoryTypes[inventoryForm.category] || []).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  <option value="Autre produit">Autre produit</option>
                </select>

                <input className="rounded-2xl border px-3 py-2" placeholder="Quantité" value={inventoryForm.quantity} onChange={(e) => setInventoryForm((prev) => ({ ...prev, quantity: e.target.value }))} />
                <input className="rounded-2xl border px-3 py-2" placeholder="Prix €" value={inventoryForm.price} onChange={(e) => setInventoryForm((prev) => ({ ...prev, price: e.target.value }))} />
              </div>

              {inventoryForm.category === "Autre produit" && (
                <div className="mt-3 flex gap-2 rounded-2xl bg-[#e0fdfa] p-2">
                  <input className="w-full rounded-xl border px-3 py-2" placeholder="Nouvelle catégorie" value={inventoryForm.categoryOther} onChange={(e) => setInventoryForm((prev) => ({ ...prev, categoryOther: e.target.value }))} />
                  <button
                    onClick={() => {
                      const value = inventoryForm.categoryOther.trim();
                      if (!value) return;
                      setInventoryTypes((prev) => ({ ...prev, [value]: [] }));
                      setInventoryForm((prev) => ({ ...prev, category: value, categoryOther: "" }));
                    }}
                    className="rounded-xl bg-[#0f766e] px-3 py-2 text-xs text-white"
                  >
                    OK
                  </button>
                </div>
              )}

              {inventoryForm.type === "Autre produit" && inventoryForm.category && (
                <div className="mt-3 flex gap-2 rounded-2xl bg-[#e0fdfa] p-2">
                  <input className="w-full rounded-xl border px-3 py-2" placeholder="Nouveau type" value={inventoryForm.typeOther} onChange={(e) => setInventoryForm((prev) => ({ ...prev, typeOther: e.target.value }))} />
                  <button
                    onClick={() => {
                      const value = inventoryForm.typeOther.trim();
                      if (!value) return;
                      setInventoryTypes((prev) => {
                        const current = prev[inventoryForm.category] || [];
                        return { ...prev, [inventoryForm.category]: [...current, value] };
                      });
                      setInventoryForm((prev) => ({ ...prev, type: value, typeOther: "" }));
                    }}
                    className="rounded-xl bg-[#0f766e] px-3 py-2 text-xs text-white"
                  >
                    OK
                  </button>
                </div>
              )}

              <button onClick={addInventoryProduct} className="mt-3 rounded-2xl bg-[#0f766e] px-4 py-2 text-white">
                Valider produit
              </button>
            </div>

            <div className={cardClass}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#0f766e]">Produits de l’inventaire</h3>
                <button
                  onClick={() => {
                    if (inventoryDraft.length === 0) {
                      showMessage("Aucun produit ajouté");
                      return;
                    }
                    setInventoryPreviewOpen(true);
                  }}
                  className="rounded-xl bg-[#0f766e] px-3 py-1 text-sm text-white"
                >
                  👁️ Aperçu
                </button>
              </div>

              {inventoryDraft.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-slate-500">
                  Aucun produit ajouté pour le moment.
                </div>
              ) : (
                <div className="space-y-2">
                  {inventoryDraft.map((item) => (
                    <div key={item.id} className="grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-5">
                      <div>
                        <p className="text-xs text-slate-500">Catégorie</p>
                        <p className="font-medium">{item.category}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Type</p>
                        <p className="font-medium">{item.type || "Aucun"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Quantité</p>
                        <p className="font-medium">{item.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Prix</p>
                        <p className="font-medium">{money(item.price)}</p>
                      </div>
                      <div className="flex items-end justify-end">
                        <button onClick={() => setDeleteTarget({ kind: "inventoryDraft", id: item.id })} className="rounded-xl bg-red-500 px-3 py-2 text-sm text-white">
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={validateInventory} className="w-full rounded-2xl bg-[#0f766e] px-4 py-3 text-white">
              Valider l’inventaire
            </button>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#0f766e]">
                  Dernier inventaire {lastInventory?.date ? `· ${lastInventory.date}` : ""}
                </h3>
                <button
                  onClick={() => {
                    if (!lastInventory) {
                      showMessage("Aucun inventaire validé");
                      return;
                    }
                    setLastInventoryPreviewOpen(true);
                  }}
                  className="rounded-xl bg-[#0f766e] px-3 py-1 text-sm text-white"
                >
                  👁️ Aperçu
                </button>
              </div>

              {lastInventory?.items?.length ? (
                <div className="mt-3 space-y-2">
                  {lastInventory.items.map((item) => (
                    <div key={item.id} className="flex justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                      <span>{item.category} · {item.type || "Aucun"}</span>
                      <span>{item.quantity} × {money(item.price)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-slate-500">Aucun inventaire validé</div>
              )}

              <button
                onClick={() => {
                  setInventoryDraft([]);
                  showMessage("Inventaire en cours effacé");
                }}
                className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-red-700"
              >
                Effacer dernier inventaire
              </button>
            </div>
          </div>
        )}

        {page === "movement" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setPage("home")} className="rounded-2xl border bg-white px-3 py-2">
                ← Accueil
              </button>
              <h2 className="text-2xl font-semibold text-[#1e3a8a]">Entrée / Sortie</h2>
            </div>

            <div className={cardClass}>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="rounded-2xl border px-3 py-2"
                  value={movementForm.movementType}
                  onChange={(e) => setMovementForm((prev) => ({ ...prev, movementType: e.target.value }))}
                >
                  <option>Entrée</option>
                  <option>Sortie</option>
                </select>

                <select
                  className="rounded-2xl border px-3 py-2"
                  value={movementForm.stockType}
                  onChange={(e) =>
                    setMovementForm((prev) => ({
                      ...prev,
                      stockType: e.target.value,
                      code: "",
                      brand: "",
                      filamentType: "",
                      color: "",
                      category: "",
                      type: "",
                      quantity: "",
                      price: "",
                    }))
                  }
                >
                  <option>Filament</option>
                  <option>Matière première</option>
                </select>
              </div>

              {movementForm.stockType === "Filament" ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                    <input
                      className="rounded-2xl border px-3 py-2"
                      placeholder="Code produit"
                      value={movementForm.code}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, code: e.target.value }))
                      }
                    />
                    <button
                      onClick={simulateScan}
                      className="rounded-2xl bg-[#7c62b3] px-4 py-2 text-white"
                    >
                      📷 Scanner
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-5">
                    <input className="rounded-2xl border px-3 py-2" placeholder="Marque" value={movementForm.brand} onChange={(e) => setMovementForm((prev) => ({ ...prev, brand: e.target.value }))} />
                    <input className="rounded-2xl border px-3 py-2" placeholder="Type" value={movementForm.filamentType} onChange={(e) => setMovementForm((prev) => ({ ...prev, filamentType: e.target.value }))} />
                    <input className="rounded-2xl border px-3 py-2" placeholder="Couleur" value={movementForm.color} onChange={(e) => setMovementForm((prev) => ({ ...prev, color: e.target.value }))} />
                    <input className="rounded-2xl border px-3 py-2" placeholder="Quantité" value={movementForm.quantity} onChange={(e) => setMovementForm((prev) => ({ ...prev, quantity: e.target.value }))} />
                    <input className="rounded-2xl border px-3 py-2" placeholder="Prix (si entrée)" value={movementForm.price} onChange={(e) => setMovementForm((prev) => ({ ...prev, price: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <input className="rounded-2xl border px-3 py-2" placeholder="Catégorie" value={movementForm.category} onChange={(e) => setMovementForm((prev) => ({ ...prev, category: e.target.value }))} />
                  <input className="rounded-2xl border px-3 py-2" placeholder="Type" value={movementForm.type} onChange={(e) => setMovementForm((prev) => ({ ...prev, type: e.target.value }))} />
                  <input className="rounded-2xl border px-3 py-2" placeholder="Quantité" value={movementForm.quantity} onChange={(e) => setMovementForm((prev) => ({ ...prev, quantity: e.target.value }))} />
                  <input className="rounded-2xl border px-3 py-2" placeholder="Prix (si entrée)" value={movementForm.price} onChange={(e) => setMovementForm((prev) => ({ ...prev, price: e.target.value }))} />
                </div>
              )}

              <button onClick={handleMovement} className="mt-4 rounded-2xl bg-[#9f7aea] px-4 py-2 text-white">
                Valider
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;