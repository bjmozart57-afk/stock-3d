import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { database } from "./firebase";
import { onValue, ref, set } from "firebase/database";

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

const brandOptions = [
  "Bambu Lab",
  "Elegoo",
  "Polymaker",
  "eSun",
  "Creality",
  "Prusa",
  "Sunlu",
  "Amazon Basics",
  "Autres",
];

const filamentTypeOptions = ["PLA", "PETG", "ABS", "TPU", "ASA", "Autre"];
const finishOptions = ["Basique", "Mat", "Silk", "Brillant", "Carbone", "Autre"];
const conditionOptions = ["Neuf", "Ouvert"];
const formatOptions = ["Bobine", "Bobine + recharge"];

const normalizeFormat = (format) => {
  if (format === "Bobine + recharge") return "Bobine";
  return format || "Bobine";
};

const resolveBrand = (obj) =>
  obj.brand === "Autres" ? obj.customBrand.trim() : obj.brand.trim();

const resolveFilamentType = (obj) =>
  obj.filamentType === "Autre"
    ? obj.customFilamentType.trim()
    : obj.filamentType.trim();

const resolveFinish = (obj) =>
  obj.finish === "Autre" ? obj.customFinish.trim() : obj.finish.trim();

const filamentGroupKey = (item) =>
  [
    item.brand?.trim()?.toLowerCase() || "",
    item.filamentType?.trim()?.toLowerCase() || "",
    item.finish?.trim()?.toLowerCase() || "",
    item.color?.trim()?.toLowerCase() || "",
    item.condition?.trim()?.toLowerCase() || "",
  ].join("|");

const materialGroupKey = (item) =>
  [
    item.category?.trim()?.toLowerCase() || "",
    item.type?.trim()?.toLowerCase() || "",
  ].join("|");

function App() {
  const [page, setPage] = useState("home");
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [inventoryPreviewOpen, setInventoryPreviewOpen] = useState(false);
  const [lastInventoryPreviewOpen, setLastInventoryPreviewOpen] = useState(false);
  const [filamentPreviewOpen, setFilamentPreviewOpen] = useState(false);
  const [materialPreviewOpen, setMaterialPreviewOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cloudReady, setCloudReady] = useState(false);

  const [editingInventoryId, setEditingInventoryId] = useState(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerRunning, setScannerRunning] = useState(false);
  const scannerRef = useRef(null);
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  const lastCloudDataRef = useRef("");

  const [settings, setSettings] = useState({
    companyName: "CREATION 3D",
    email: "",
    tva: 20,
    version: "2.4.1",
  });

  const [filaments, setFilaments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [inventoryDraft, setInventoryDraft] = useState([]);
  const [inventoryHistory, setInventoryHistory] = useState([]);
  const [inventoryTypes, setInventoryTypes] = useState(inventoryTypeDefaults);

  const [filamentFilters, setFilamentFilters] = useState({
    brand: "",
    filamentType: "",
  });

  const [materialFilters, setMaterialFilters] = useState({
    category: "",
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
    brand: "Bambu Lab",
    customBrand: "",
    filamentType: "PLA",
    customFilamentType: "",
    finish: "Basique",
    customFinish: "",
    color: "",
    condition: "Neuf",
    format: "Bobine",
    category: "",
    type: "",
    quantity: "",
    price: "",
    useMinimum: false,
    minimum: "",
  });

  useEffect(() => {
    const stockRef = ref(database, "stock3d");

    const unsubscribe = onValue(
      stockRef,
      (snapshot) => {
        const data = snapshot.val();
        const serialized = JSON.stringify(data || {});

        if (serialized === lastCloudDataRef.current) {
          setCloudReady(true);
          return;
        }

        lastCloudDataRef.current = serialized;

        if (data?.settings) setSettings({ ...data.settings, version: "2.4.1" });
        if (data?.filaments) setFilaments(data.filaments);
        if (data?.materials) setMaterials(data.materials);
        if (data?.inventoryDraft) setInventoryDraft(data.inventoryDraft);
        if (data?.inventoryHistory) setInventoryHistory(data.inventoryHistory);
        if (data?.inventoryTypes) setInventoryTypes(data.inventoryTypes);

        setCloudReady(true);
      },
      () => setCloudReady(true)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!cloudReady) return;

    const payload = {
      settings: {
        ...settings,
        version: "2.4.1",
      },
      filaments,
      materials,
      inventoryDraft,
      inventoryHistory,
      inventoryTypes,
    };

    const serialized = JSON.stringify(payload);
    if (serialized === lastCloudDataRef.current) return;

    lastCloudDataRef.current = serialized;
    set(ref(database, "stock3d"), payload);
  }, [cloudReady, settings, filaments, materials, inventoryDraft, inventoryHistory, inventoryTypes]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current.clear().catch(() => {});
        } catch {
          // ignore
        }
      }
    };
  }, []);

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

  const filteredFilaments = useMemo(() => {
    return filaments.filter((item) => {
      const brandOk =
        !filamentFilters.brand ||
        item.brand?.toLowerCase() === filamentFilters.brand.toLowerCase();

      const typeOk =
        !filamentFilters.filamentType ||
        item.filamentType?.toLowerCase() ===
          filamentFilters.filamentType.toLowerCase();

      return brandOk && typeOk;
    });
  }, [filaments, filamentFilters]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const categoryOk =
        !materialFilters.category ||
        item.category?.toLowerCase() === materialFilters.category.toLowerCase();

      return categoryOk;
    });
  }, [materials, materialFilters]);

  const filteredFilamentTTC = useMemo(
    () =>
      filteredFilaments.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
        0
      ),
    [filteredFilaments]
  );

  const filteredFilamentHT = useMemo(
    () => filteredFilamentTTC / (1 + toNumber(settings.tva) / 100),
    [filteredFilamentTTC, settings.tva]
  );

  const filteredMaterialTTC = useMemo(
    () =>
      filteredMaterials.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.price),
        0
      ),
    [filteredMaterials]
  );

  const filteredMaterialHT = useMemo(
    () => filteredMaterialTTC / (1 + toNumber(settings.tva) / 100),
    [filteredMaterialTTC, settings.tva]
  );

  const lastInventory = inventoryHistory[0] || null;
  const last3Inventories = inventoryHistory.slice(0, 3);

  const isLowStock = (item) =>
    toNumber(item.minimum) > 0 &&
    toNumber(item.quantity) > 0 &&
    toNumber(item.quantity) <= toNumber(item.minimum);

  const isOutOfStock = (item) => toNumber(item.quantity) <= 0;

  const lowFilaments = filaments.filter(isLowStock);
  const lowMaterials = materials.filter(isLowStock);

  const ruptureFilaments = filaments.filter(isOutOfStock);
  const ruptureMaterials = materials.filter(isOutOfStock);

  const badgeStatus = (item) => {
    if (isOutOfStock(item)) {
      return (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
          ⛔ Rupture
        </span>
      );
    }
    if (isLowStock(item)) {
      return (
        <span className="rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-700">
          ⚠️ Stock bas
        </span>
      );
    }
    return (
      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
        ✔ OK
      </span>
    );
  };

  const openPrintWindow = (title, items, ttc, ht) => {
    const rows = items
      .map(
        (item) => `
          <tr>
            <td>${item.category || item.brand || "-"}</td>
            <td>${item.type || item.filamentType || "-"}</td>
            <td>${item.finish || "-"}</td>
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
                <th>Finition</th>
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
        `- ${item.category || item.brand || "-"} | ${
          item.type || item.filamentType || "-"
        } | ${item.color || "-"} | Qté: ${item.quantity} | Prix: ${money(item.price)}`
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
    setEditingInventoryId(null);
  };

  const addOrUpdateInventoryProduct = () => {
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
      id: editingInventoryId || Date.now(),
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

    if (editingInventoryId) {
      setInventoryDraft((prev) =>
        prev.map((p) => (p.id === editingInventoryId ? item : p))
      );
      showMessage("Produit inventaire modifié");
      resetInventoryForm();
      return;
    }

    setInventoryDraft((prev) => [item, ...prev]);
    showMessage("Produit ajouté à l’inventaire");
    resetInventoryForm();
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

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRunning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      }
    } catch {
      // ignore
    } finally {
      scannerRef.current = null;
      setScannerRunning(false);
      setScannerOpen(false);
      setScannerError("");
    }
  };

  const startScanner = async () => {
    if (!isAndroid) {
      showMessage("Scanner disponible uniquement sur Android");
      return;
    }

    if (movementForm.stockType !== "Filament") {
      showMessage("Scanner uniquement pour Filament");
      return;
    }

    setScannerError("");
    setScannerOpen(true);

    setTimeout(async () => {
      try {
        if (scannerRef.current) return;

        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 120 },
            aspectRatio: 1.7778,
          },
          async (decodedText) => {
            const scannedCode = String(decodedText || "").trim();
            const found = filaments.find(
              (item) => String(item.code || "").trim() === scannedCode
            );

            if (found) {
              setMovementForm((prev) => ({
                ...prev,
                code: scannedCode,
                brand: brandOptions.includes(found.brand) ? found.brand : "Autres",
                customBrand: brandOptions.includes(found.brand) ? "" : found.brand || "",
                filamentType: filamentTypeOptions.includes(found.filamentType)
                  ? found.filamentType
                  : "Autre",
                customFilamentType: filamentTypeOptions.includes(found.filamentType)
                  ? ""
                  : found.filamentType || "",
                finish: finishOptions.includes(found.finish) ? found.finish : "Autre",
                customFinish: finishOptions.includes(found.finish) ? "" : found.finish || "",
                color: found.color || "",
                condition: found.condition || "Neuf",
                format: found.format || "Bobine",
                price:
                  prev.movementType === "Entrée"
                    ? String(found.price || "")
                    : prev.price,
              }));
              showMessage("Produit reconnu automatiquement");
            } else {
              setMovementForm((prev) => ({
                ...prev,
                code: scannedCode,
              }));
              showMessage("Code scanné");
            }

            await stopScanner();
          },
          () => {}
        );

        setScannerRunning(true);
      } catch {
        setScannerError("Impossible de lancer le scanner");
        setScannerRunning(false);
      }
    }, 150);
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
        brand: brandOptions.includes(randomItem.brand) ? randomItem.brand : "Autres",
        customBrand: brandOptions.includes(randomItem.brand) ? "" : randomItem.brand || "",
        filamentType: filamentTypeOptions.includes(randomItem.filamentType)
          ? randomItem.filamentType
          : "Autre",
        customFilamentType: filamentTypeOptions.includes(randomItem.filamentType)
          ? ""
          : randomItem.filamentType || "",
        finish: finishOptions.includes(randomItem.finish) ? randomItem.finish : "Autre",
        customFinish: finishOptions.includes(randomItem.finish)
          ? ""
          : randomItem.finish || "",
        color: randomItem.color || "",
        condition: randomItem.condition || "Neuf",
        format: randomItem.format || "Bobine",
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
      const brand = resolveBrand(movementForm);
      const filamentType = resolveFilamentType(movementForm);
      const finish = resolveFinish(movementForm);

      if (!brand || !filamentType || !finish || !movementForm.color.trim()) {
        showMessage("Complète marque, type, finition et couleur");
        return;
      }

      const candidate = {
        brand,
        filamentType,
        finish,
        color: movementForm.color.trim(),
        condition: movementForm.condition,
      };

      const matchIndex = filaments.findIndex(
        (item) => filamentGroupKey(item) === filamentGroupKey(candidate)
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
            minimum: movementForm.useMinimum
              ? toNumber(movementForm.minimum)
              : updated[matchIndex].minimum || 0,
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
              brand,
              filamentType,
              finish,
              color: movementForm.color.trim(),
              condition: movementForm.condition,
              format: normalizeFormat(movementForm.format),
              quantity: qty,
              price: toNumber(movementForm.price),
              minimum: movementForm.useMinimum ? toNumber(movementForm.minimum) : 0,
              code:
                movementForm.code ||
                "FIL-" + Math.floor(1000 + Math.random() * 9000),
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
            minimum: movementForm.useMinimum
              ? toNumber(movementForm.minimum)
              : updated[matchIndex].minimum || 0,
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
              minimum: movementForm.useMinimum ? toNumber(movementForm.minimum) : 0,
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
      brand: "Bambu Lab",
      customBrand: "",
      filamentType: "PLA",
      customFilamentType: "",
      finish: "Basique",
      customFinish: "",
      color: "",
      condition: "Neuf",
      format: "Bobine",
      category: "",
      type: "",
      quantity: "",
      price: "",
      useMinimum: false,
      minimum: "",
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

  const editInventoryItem = (item) => {
    setEditingInventoryId(item.id);
    setInventoryForm({
      category: item.category || "",
      type: item.type || "",
      quantity: String(item.quantity ?? ""),
      price: String(item.price ?? ""),
      categoryOther: "",
      typeOther: "",
    });
    setPage("inventory");
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

        {filamentPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Aperçu filaments filtrés</h2>
                <button
                  onClick={() => setFilamentPreviewOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-3 text-sm text-slate-600">
                <div>Date : {todayFr()}</div>
                <div>Produits : {filteredFilaments.length}</div>
              </div>

              <div className="mt-4 space-y-2">
                {filteredFilaments.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-2xl border p-3 text-sm md:grid-cols-6"
                  >
                    <div>{item.brand}</div>
                    <div>{item.filamentType}</div>
                    <div>{item.finish}</div>
                    <div>{item.color}</div>
                    <div>{item.quantity}</div>
                    <div>{money(item.price)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 text-sm font-medium">
                <div>TTC : {money(filteredFilamentTTC)}</div>
                <div>HT : {money(filteredFilamentHT)}</div>
              </div>

              <div className="mt-4">
                <button
                  onClick={() =>
                    openPrintWindow(
                      "Liste filtrée filaments",
                      filteredFilaments,
                      filteredFilamentTTC,
                      filteredFilamentHT
                    )
                  }
                  className="w-full rounded-2xl bg-[#1e3a8a] py-2 text-sm text-white"
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {materialPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Aperçu matières filtrées</h2>
                <button
                  onClick={() => setMaterialPreviewOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-3 text-sm text-slate-600">
                <div>Date : {todayFr()}</div>
                <div>Produits : {filteredMaterials.length}</div>
              </div>

              <div className="mt-4 space-y-2">
                {filteredMaterials.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-2xl border p-3 text-sm md:grid-cols-4"
                  >
                    <div>{item.category}</div>
                    <div>{item.type || "Aucun"}</div>
                    <div>{item.quantity}</div>
                    <div>{money(item.price)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1 text-sm font-medium">
                <div>TTC : {money(filteredMaterialTTC)}</div>
                <div>HT : {money(filteredMaterialHT)}</div>
              </div>

              <div className="mt-4">
                <button
                  onClick={() =>
                    openPrintWindow(
                      "Liste filtrée matières premières",
                      filteredMaterials,
                      filteredMaterialTTC,
                      filteredMaterialHT
                    )
                  }
                  className="w-full rounded-2xl bg-[#1e3a8a] py-2 text-sm text-white"
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {scannerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Scanner Android</h2>
                <button
                  onClick={stopScanner}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-sm"
                >
                  Fermer
                </button>
              </div>

              {!isAndroid ? (
                <div className="mt-4 rounded-2xl bg-orange-50 p-3 text-sm text-orange-700">
                  Scanner disponible uniquement sur téléphone Android.
                </div>
              ) : (
                <>
                  <div className="mt-4 overflow-hidden rounded-2xl border">
                    <div id="reader" style={{ width: "100%" }} />
                  </div>

                  {scannerError && (
                    <div className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                      {scannerError}
                    </div>
                  )}

                  <div className="mt-3 text-sm text-slate-500">
                    Place le code-barres devant la caméra arrière.
                  </div>
                </>
              )}
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
                  onClick={() =>
                    sendByEmail("Inventaire en cours", inventoryDraft, draftTTC, draftHT)
                  }
                  className="flex-1 rounded-2xl border border-[#0f766e] bg-white py-2 text-sm text-[#0f766e]"
                >
                  ✉️ Envoyer par mail
                </button>
                <button
                  onClick={() =>
                    openPrintWindow(
                      "Inventaire en cours",
                      inventoryDraft,
                      draftTTC,
                      draftHT
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
              <button
                onClick={() => setPage("home")}
                className="rounded-2xl border bg-white px-3 py-2"
              >
                ← Accueil
              </button>
              <h2 className="text-2xl font-semibold text-[#1e3a8a]">Filament</h2>
            </div>

            <div className={`${cardClass} bg-[#dbeafe] border-[#bfdbfe]`}>
              <h3 className="mb-3 text-lg font-semibold text-[#1e3a8a]">
                Filtrer les filaments
              </h3>

              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className="rounded-2xl border px-3 py-2"
                  value={filamentFilters.brand}
                  onChange={(e) =>
                    setFilamentFilters((prev) => ({ ...prev, brand: e.target.value }))
                  }
                >
                  <option value="">Toutes les marques</option>
                  {[...new Set(filaments.map((f) => f.brand).filter(Boolean))].map(
                    (brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    )
                  )}
                </select>

                <select
                  className="rounded-2xl border px-3 py-2"
                  value={filamentFilters.filamentType}
                  onChange={(e) =>
                    setFilamentFilters((prev) => ({
                      ...prev,
                      filamentType: e.target.value,
                    }))
                  }
                >
                  <option value="">Tous les types</option>
                  {[...new Set(filaments.map((f) => f.filamentType).filter(Boolean))].map(
                    (type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    )
                  )}
                </select>

                <button
                  onClick={() =>
                    setFilamentFilters({
                      brand: "",
                      filamentType: "",
                    })
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2"
                >
                  Réinitialiser
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (filteredFilaments.length === 0) {
                      showMessage("Aucun filament à afficher");
                      return;
                    }
                    setFilamentPreviewOpen(true);
                  }}
                  className="rounded-2xl bg-[#1e3a8a] px-4 py-2 text-white"
                >
                  👁️ Aperçu avant impression
                </button>

                <button
                  onClick={() => {
                    if (filteredFilaments.length === 0) {
                      showMessage("Aucun filament à imprimer");
                      return;
                    }
                    openPrintWindow(
                      "Liste filtrée filaments",
                      filteredFilaments,
                      filteredFilamentTTC,
                      filteredFilamentHT
                    );
                  }}
                  className="rounded-2xl border border-[#1e3a8a] bg-white px-4 py-2 text-[#1e3a8a]"
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>

            {filteredFilaments.length === 0 ? (
              <div className={cardClass}>Aucun filament correspondant au filtre.</div>
            ) : (
              <div className={cardClass}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#1e3a8a]">Liste filtrée</h3>
                  <span className="text-sm text-slate-500">
                    {filteredFilaments.length} résultat(s)
                  </span>
                </div>

                <div className="space-y-2">
                  {filteredFilaments.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-9"
                    >
                      <div>
                        <p className="text-xs text-slate-500">Marque</p>
                        <p className="font-medium">{item.brand}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Type</p>
                        <p className="font-medium">{item.filamentType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Finition</p>
                        <p className="font-medium">{item.finish}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Couleur</p>
                        <p className="font-medium">{item.color}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">État</p>
                        <p className="font-medium">{item.condition}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Format</p>
                        <p className="font-medium">Bobine</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Quantité</p>
                        <p className="font-medium">{item.quantity}</p>
                        {toNumber(item.minimum) > 0 && (
                          <p className="text-xs text-slate-400">Min : {item.minimum}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Prix</p>
                        <p className="font-medium">{money(item.price)}</p>
                        <div className="mt-2">{badgeStatus(item)}</div>
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          onClick={() =>
                            setDeleteTarget({ kind: "filament", id: item.id })
                          }
                          className="rounded-xl bg-red-500 px-3 py-2 text-sm text-white"
                        >
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
              <button
                onClick={() => setPage("home")}
                className="rounded-2xl border bg-white px-3 py-2"
              >
                ← Accueil
              </button>
              <h2 className="text-2xl font-semibold text-[#1e3a8a]">
                Matière première
              </h2>
            </div>

            <div className={`${cardClass} bg-[#dbeafe] border-[#bfdbfe]`}>
              <h3 className="mb-3 text-lg font-semibold text-[#1e3a8a]">
                Filtrer par catégorie
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="rounded-2xl border px-3 py-2"
                  value={materialFilters.category}
                  onChange={(e) =>
                    setMaterialFilters((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                >
                  <option value="">Toutes les catégories</option>
                  {[...new Set(materials.map((m) => m.category).filter(Boolean))].map(
                    (category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    )
                  )}
                </select>

                <button
                  onClick={() =>
                    setMaterialFilters({
                      category: "",
                    })
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2"
                >
                  Réinitialiser
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (filteredMaterials.length === 0) {
                      showMessage("Aucune matière à afficher");
                      return;
                    }
                    setMaterialPreviewOpen(true);
                  }}
                  className="rounded-2xl bg-[#1e3a8a] px-4 py-2 text-white"
                >
                  👁️ Aperçu avant impression
                </button>

                <button
                  onClick={() => {
                    if (filteredMaterials.length === 0) {
                      showMessage("Aucune matière à imprimer");
                      return;
                    }
                    openPrintWindow(
                      "Liste filtrée matières premières",
                      filteredMaterials,
                      filteredMaterialTTC,
                      filteredMaterialHT
                    );
                  }}
                  className="rounded-2xl border border-[#1e3a8a] bg-white px-4 py-2 text-[#1e3a8a]"
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>

            {filteredMaterials.length === 0 ? (
              <div className={cardClass}>Aucune matière correspondant au filtre.</div>
            ) : (
              <div className={cardClass}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#1e3a8a]">Liste filtrée</h3>
                  <span className="text-sm text-slate-500">
                    {filteredMaterials.length} résultat(s)
                  </span>
                </div>

                <div className="space-y-2">
                  {filteredMaterials.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-6"
                    >
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
                        {toNumber(item.minimum) > 0 && (
                          <p className="text-xs text-slate-400">Min : {item.minimum}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Prix</p>
                        <p className="font-medium">{money(item.price)}</p>
                      </div>
                      <div>
                        <div className="mt-6">{badgeStatus(item)}</div>
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          onClick={() =>
                            setDeleteTarget({ kind: "material", id: item.id })
                          }
                          className="rounded-xl bg-red-500 px-3 py-2 text-sm text-white"
                        >
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
              <button
                onClick={() => {
                  resetInventoryForm();
                  setPage("home");
                }}
                className="rounded-2xl border bg-white px-3 py-2"
              >
                ← Accueil
              </button>
              <h2 className="text-2xl font-semibold text-[#0f766e]">Inventaire</h2>
            </div>

            <div className={`${cardClass} bg-[#ccfbf1] border-[#99f6e4]`}>
              <h3 className="mb-3 text-lg font-semibold text-[#0f766e]">
                {editingInventoryId ? "Modifier produit inventaire" : "Inventaire production"}
              </h3>

              <div className="grid gap-3 md:grid-cols-4">
                <select
                  className="rounded-2xl border px-3 py-2"
                  value={inventoryForm.category}
                  onChange={(e) =>
                    setInventoryForm((prev) => ({ ...prev, category: e.target.value, type: "" }))
                  }
                >
                  <option value="">Catégorie</option>
                  {Object.keys(inventoryTypes).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="Autre produit">Autre produit</option>
                </select>

                <select
                  className="rounded-2xl border px-3 py-2"
                  value={inventoryForm.type}
                  onChange={(e) =>
                    setInventoryForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                >
                  <option value="">Type</option>
                  {(inventoryTypes[inventoryForm.category] || []).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                  <option value="Autre produit">Autre produit</option>
                </select>

                <input
                  className="rounded-2xl border px-3 py-2"
                  placeholder="Quantité"
                  value={inventoryForm.quantity}
                  onChange={(e) =>
                    setInventoryForm((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                />

                <input
                  className="rounded-2xl border px-3 py-2"
                  placeholder="Prix €"
                  value={inventoryForm.price}
                  onChange={(e) =>
                    setInventoryForm((prev) => ({ ...prev, price: e.target.value }))
                  }
                />
              </div>

              {inventoryForm.category === "Autre produit" && (
                <div className="mt-3 flex gap-2 rounded-2xl bg-[#e0fdfa] p-2">
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="Nouvelle catégorie"
                    value={inventoryForm.categoryOther}
                    onChange={(e) =>
                      setInventoryForm((prev) => ({
                        ...prev,
                        categoryOther: e.target.value,
                      }))
                    }
                  />
                  <button
                    onClick={() => {
                      const value = inventoryForm.categoryOther.trim();
                      if (!value) return;
                      setInventoryTypes((prev) => ({ ...prev, [value]: [] }));
                      setInventoryForm((prev) => ({
                        ...prev,
                        category: value,
                        categoryOther: "",
                      }));
                    }}
                    className="rounded-xl bg-[#0f766e] px-3 py-2 text-xs text-white"
                  >
                    Valider
                  </button>
                </div>
              )}

              {inventoryForm.type === "Autre produit" && inventoryForm.category && (
                <div className="mt-3 flex gap-2 rounded-2xl bg-[#e0fdfa] p-2">
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    placeholder="Nouveau type"
                    value={inventoryForm.typeOther}
                    onChange={(e) =>
                      setInventoryForm((prev) => ({ ...prev, typeOther: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => {
                      const value = inventoryForm.typeOther.trim();
                      if (!value) return;
                      setInventoryTypes((prev) => {
                        const current = prev[inventoryForm.category] || [];
                        return { ...prev, [inventoryForm.category]: [...current, value] };
                      });
                      setInventoryForm((prev) => ({
                        ...prev,
                        type: value,
                        typeOther: "",
                      }));
                    }}
                    className="rounded-xl bg-[#0f766e] px-3 py-2 text-xs text-white"
                  >
                    Valider
                  </button>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={addOrUpdateInventoryProduct}
                  className="rounded-2xl bg-[#0f766e] px-4 py-2 text-white"
                >
                  {editingInventoryId ? "Enregistrer modification" : "Valider produit"}
                </button>

                {editingInventoryId && (
                  <button
                    onClick={resetInventoryForm}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2"
                  >
                    Annuler
                  </button>
                )}
              </div>
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
                    <div
                      key={item.id}
                      className="grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-6"
                    >
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
                      <div className="flex items-end justify-end gap-2 md:col-span-2">
                        <button
                          onClick={() => editInventoryItem(item)}
                          className="rounded-xl bg-amber-500 px-3 py-2 text-sm text-white"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({ kind: "inventoryDraft", id: item.id })
                          }
                          className="rounded-xl bg-red-500 px-3 py-2 text-sm text-white"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={validateInventory}
              className="w-full rounded-2xl bg-[#0f766e] px-4 py-3 text-white"
            >
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
                    <div
                      key={item.id}
                      className="flex justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm"
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
              <button
                onClick={() => setPage("home")}
                className="rounded-2xl border bg-white px-3 py-2"
              >
                ← Accueil
              </button>
              <h2 className="text-2xl font-semibold text-[#1e3a8a]">Entrée / Sortie</h2>
            </div>

            <div className={cardClass}>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="rounded-2xl border px-3 py-2"
                  value={movementForm.movementType}
                  onChange={(e) =>
                    setMovementForm((prev) => ({ ...prev, movementType: e.target.value }))
                  }
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
                      brand: "Bambu Lab",
                      customBrand: "",
                      filamentType: "PLA",
                      customFilamentType: "",
                      finish: "Basique",
                      customFinish: "",
                      color: "",
                      condition: "Neuf",
                      format: "Bobine",
                      category: "",
                      type: "",
                      quantity: "",
                      price: "",
                      useMinimum: false,
                      minimum: "",
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
                      onClick={startScanner}
                      className="rounded-2xl bg-[#7c62b3] px-4 py-2 text-white"
                    >
                      📷 Scanner Android
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <select
                      className="rounded-2xl border px-3 py-2"
                      value={movementForm.brand}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, brand: e.target.value }))
                      }
                    >
                      {brandOptions.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>

                    <select
                      className="rounded-2xl border px-3 py-2"
                      value={movementForm.filamentType}
                      onChange={(e) =>
                        setMovementForm((prev) => ({
                          ...prev,
                          filamentType: e.target.value,
                        }))
                      }
                    >
                      {filamentTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>

                    <select
                      className="rounded-2xl border px-3 py-2"
                      value={movementForm.finish}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, finish: e.target.value }))
                      }
                    >
                      {finishOptions.map((finish) => (
                        <option key={finish} value={finish}>
                          {finish}
                        </option>
                      ))}
                    </select>

                    <input
                      className="rounded-2xl border px-3 py-2"
                      placeholder="Couleur"
                      value={movementForm.color}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, color: e.target.value }))
                      }
                    />
                  </div>

                  {movementForm.brand === "Autres" && (
                    <div className="flex gap-2 rounded-2xl bg-slate-50 p-2">
                      <input
                        className="w-full rounded-xl border px-3 py-2"
                        placeholder="Autre marque"
                        value={movementForm.customBrand}
                        onChange={(e) =>
                          setMovementForm((prev) => ({ ...prev, customBrand: e.target.value }))
                        }
                      />
                      <button className="rounded-xl bg-[#1e3a8a] px-3 py-2 text-xs text-white">
                        Valider
                      </button>
                    </div>
                  )}

                  {movementForm.filamentType === "Autre" && (
                    <div className="flex gap-2 rounded-2xl bg-slate-50 p-2">
                      <input
                        className="w-full rounded-xl border px-3 py-2"
                        placeholder="Autre type"
                        value={movementForm.customFilamentType}
                        onChange={(e) =>
                          setMovementForm((prev) => ({
                            ...prev,
                            customFilamentType: e.target.value,
                          }))
                        }
                      />
                      <button className="rounded-xl bg-[#1e3a8a] px-3 py-2 text-xs text-white">
                        Valider
                      </button>
                    </div>
                  )}

                  {movementForm.finish === "Autre" && (
                    <div className="flex gap-2 rounded-2xl bg-slate-50 p-2">
                      <input
                        className="w-full rounded-xl border px-3 py-2"
                        placeholder="Autre finition"
                        value={movementForm.customFinish}
                        onChange={(e) =>
                          setMovementForm((prev) => ({
                            ...prev,
                            customFinish: e.target.value,
                          }))
                        }
                      />
                      <button className="rounded-xl bg-[#1e3a8a] px-3 py-2 text-xs text-white">
                        Valider
                      </button>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-4">
                    <select
                      className="rounded-2xl border px-3 py-2"
                      value={movementForm.condition}
                      onChange={(e) =>
                        setMovementForm((prev) => ({
                          ...prev,
                          condition: e.target.value,
                        }))
                      }
                    >
                      {conditionOptions.map((condition) => (
                        <option key={condition} value={condition}>
                          {condition}
                        </option>
                      ))}
                    </select>

                    <select
                      className="rounded-2xl border px-3 py-2"
                      value={movementForm.format}
                      onChange={(e) =>
                        setMovementForm((prev) => ({
                          ...prev,
                          format: e.target.value,
                        }))
                      }
                    >
                      {formatOptions.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </select>

                    <input
                      className="rounded-2xl border px-3 py-2"
                      placeholder="Quantité"
                      value={movementForm.quantity}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, quantity: e.target.value }))
                      }
                    />

                    <input
                      className="rounded-2xl border px-3 py-2"
                      placeholder="Prix (si entrée)"
                      value={movementForm.price}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, price: e.target.value }))
                      }
                    />
                  </div>

                  {movementForm.movementType === "Entrée" && (
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={movementForm.useMinimum}
                          onChange={(e) =>
                            setMovementForm((prev) => ({
                              ...prev,
                              useMinimum: e.target.checked,
                              minimum: e.target.checked ? prev.minimum : "",
                            }))
                          }
                        />
                        Activer stock minimum
                      </label>

                      {movementForm.useMinimum && (
                        <input
                          className="mt-3 w-full rounded-2xl border px-3 py-2"
                          placeholder="Stock minimum"
                          value={movementForm.minimum}
                          onChange={(e) =>
                            setMovementForm((prev) => ({
                              ...prev,
                              minimum: e.target.value,
                            }))
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <input
                      className="rounded-2xl border px-3 py-2"
                      placeholder="Catégorie"
                      value={movementForm.category}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, category: e.target.value }))
                      }
                    />
                    <input
                      className="rounded-2xl border px-3 py-2"
                      placeholder="Type"
                      value={movementForm.type}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, type: e.target.value }))
                      }
                    />
                    <input
                      className="rounded-2xl border px-3 py-2"
                      placeholder="Quantité"
                      value={movementForm.quantity}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, quantity: e.target.value }))
                      }
                    />
                    <input
                      className="rounded-2xl border px-3 py-2"
                      placeholder="Prix (si entrée)"
                      value={movementForm.price}
                      onChange={(e) =>
                        setMovementForm((prev) => ({ ...prev, price: e.target.value }))
                      }
                    />
                  </div>

                  {movementForm.movementType === "Entrée" && (
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={movementForm.useMinimum}
                          onChange={(e) =>
                            setMovementForm((prev) => ({
                              ...prev,
                              useMinimum: e.target.checked,
                              minimum: e.target.checked ? prev.minimum : "",
                            }))
                          }
                        />
                        Activer stock minimum
                      </label>

                      {movementForm.useMinimum && (
                        <input
                          className="mt-3 w-full rounded-2xl border px-3 py-2"
                          placeholder="Stock minimum"
                          value={movementForm.minimum}
                          onChange={(e) =>
                            setMovementForm((prev) => ({
                              ...prev,
                              minimum: e.target.value,
                            }))
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleMovement}
                className="mt-4 rounded-2xl bg-[#9f7aea] px-4 py-2 text-white"
              >
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