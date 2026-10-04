// src/App.tsx
import React, { useEffect, useState } from "react";
import { auth, signIn, signOutUser, db } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { FaHeart, FaCheck, FaPlus, FaSearch, FaRandom, FaEdit, FaTrash } from "react-icons/fa";
import classNames from "classnames";
import confetti from "canvas-confetti";
import Modal from "react-modal";
import { PhotoUploader } from "./components/PhotoUploader";

// Types
export type Plan = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  cost?: string;
  proposer?: string; // "Yo" | "Pareja"
  category: "gratis" | "asequible" | "caro" | "hecho";
  status: "pendiente" | "hecho";
  createdAt: any;
  doneAt?: any;
  photos?: string[]; // storage URLs
};

// Helper to get collection reference for the shared list
const plansCollection = collection(db, "plans");

const categories: { label: string; value: Plan["category"] }[] = [
  { label: "Planes gratis", value: "gratis" },
  { label: "Planes asequibles", value: "asequible" },
  { label: "Planes caros", value: "caro" },
  { label: "Planes hechos", value: "hecho" },
];

Modal.setAppElement("#root"); // for accessibility

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeTab, setActiveTab] = useState<Plan["category"]>("gratis");
  const [search, setSearch] = useState("");
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [doneModalPlan, setDoneModalPlan] = useState<Plan | null>(null);
  const [doneDate, setDoneDate] = useState<string>("");

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Real‑time listener for plans
  useEffect(() => {
    const q = query(plansCollection);
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Plan[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as Omit<Plan, "id">;
        data.push({ id: docSnap.id, ...d });
      });
      setPlans(data);
    });
    return () => unsub();
  }, []);

  const handleAddPlan = async (title: string) => {
    if (!title.trim()) return;
    await addDoc(plansCollection, {
      title,
      category: activeTab,
      status: "pendiente",
      createdAt: serverTimestamp(),
    });
  };

  const openDoneModal = (plan: Plan) => {
    setDoneModalPlan(plan);
    setDoneDate("");
  };

  const confirmDone = async () => {
    if (!doneModalPlan) return;
    const planRef = doc(plansCollection, doneModalPlan.id);
    await updateDoc(planRef, {
      status: "hecho",
      category: "hecho",
      doneAt: serverTimestamp(),
      ...(doneDate && { doneAt: new Date(doneDate) }),
    });
    // confetti celebration
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    setDoneModalPlan(null);
  };

  const handlePhotoUpload = async (urls: string[]) => {
    if (!doneModalPlan) return;
    const planRef = doc(plansCollection, doneModalPlan.id);
    await updateDoc(planRef, { photos: urls });
    // keep modal open to allow further uploads if desired
  };

  const deletePlan = async (plan: Plan) => {
    await deleteDoc(doc(plansCollection, plan.id));
  };

  const openEditModal = (plan: Plan) => {
    setEditPlan(plan);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPlan) return;
    const { id, title, description, location, cost, proposer, category } = editPlan;
    const planRef = doc(plansCollection, id);
    await updateDoc(planRef, { title, description, location, cost, proposer, category });
    setEditPlan(null);
  };

  const randomPlan = () => {
    const pending = plans.filter((p) => p.status === "pendiente");
    if (pending.length === 0) return alert("No hay planes pendientes.");
    const r = pending[Math.floor(Math.random() * pending.length)];
    alert(`Te sugiero: ${r.title}`);
  };

  const filtered = plans.filter(
    (p) => p.category === activeTab && (p.title.toLowerCase().includes(search.toLowerCase()) || (p.description && p.description.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="min-h-screen flex flex-col bg-cream-50 text-gray-800 p-4">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-rose-600">Bucket List de Pareja</h1>
        {user ? (
          <button onClick={signOutUser} className="text-sm underline">
            Cerrar sesión
          </button>
        ) : (
          <button onClick={signIn} className="bg-rose-500 text-white px-3 py-1 rounded">
            Entrar con Google
          </button>
        )}
      </header>

      <nav className="flex space-x-2 mb-4 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c.value}
            onClick={() => setActiveTab(c.value)}
            className={classNames(
              "px-3 py-1 rounded-full text-sm",
              activeTab === c.value ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-800"
            )}
          >
            {c.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center mb-2">
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border rounded px-2 py-1 mr-2"
        />
        <button onClick={randomPlan} className="bg-peach-500 text-white px-3 py-1 rounded">
          <FaRandom className="inline mr-1" /> Sorpréndeme
        </button>
      </div>

      {/* Add plan quick form */}
      {activeTab !== "hecho" && (
        <div className="flex mb-4">
          <input
            type="text"
            placeholder={`Nuevo plan en ${activeTab}`}
            className="flex-1 border rounded px-2 py-1 mr-2"
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                await handleAddPlan((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <button
            onClick={async () => {
              const input = document.querySelector<HTMLInputElement>("input[placeholder^='Nuevo plan']");
              if (input) {
                await handleAddPlan(input.value);
                input.value = "";
              }
            }}
            className="bg-rose-500 text-white px-3 py-1 rounded flex items-center"
          >
            <FaPlus className="mr-1" /> Añadir
          </button>
        </div>
      )}

      {/* List */}
      <section className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 mt-8">¡Aún no hay planes aquí, añade el primero!</p>
        ) : (
          filtered.map((plan) => (
            <div key={plan.id} className="border rounded-lg p-3 mb-2 bg-white shadow-sm flex justify-between items-center">
              <div>
                <h3 className="font-medium text-rose-700">{plan.title}</h3>
                {plan.description && <p className="text-sm text-gray-600">{plan.description}</p>}
              </div>
              <div className="flex space-x-2 items-center">
                {plan.status === "pendiente" && activeTab !== "hecho" && (
                  <button onClick={() => openDoneModal(plan)} className="text-green-600 hover:text-green-800">
                    <FaCheck />
                  </button>
                )}
                <button onClick={() => openEditModal(plan)} className="text-blue-600 hover:text-blue-800">
                  <FaEdit />
                </button>
                <button onClick={() => deletePlan(plan)} className="text-red-600 hover:text-red-800">
                  <FaTrash />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Progress bar */}
      <footer className="mt-4">
        <div className="text-center mb-1">
          {plans.filter((p) => p.status === "hecho").length} de {plans.length} planes hechos
        </div>
        <div className="w-full bg-rose-200 rounded h-2">
          <div
            className="bg-rose-500 h-2 rounded"
            style={{ width: `${(plans.filter((p) => p.status === "hecho").length / (plans.length || 1)) * 100}%` }}
          />
        </div>
      </footer>

      {/* Modal para marcar como hecho */}
      <Modal
        isOpen={!!doneModalPlan}
        onRequestClose={() => setDoneModalPlan(null)}
        contentLabel="Marcar como hecho"
        className="bg-white rounded p-4 max-w-md mx-auto mt-20 outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center"
      >
        <h2 className="text-xl font-bold mb-2">Marcar como hecho</h2>
        <p className="mb-2">"{doneModalPlan?.title}"</p>
        <label className="block mb-2">
          Fecha (opcional):
          <input type="date" value={doneDate} onChange={(e) => setDoneDate(e.target.value)} className="border rounded w-full" />
        </label>
        <PhotoUploader planId={doneModalPlan?.id ?? ""} onUploadComplete={handlePhotoUpload} />
        <div className="flex justify-end space-x-2 mt-4">
          <button onClick={() => setDoneModalPlan(null)} className="px-3 py-1 rounded border">Cancelar</button>
          <button onClick={confirmDone} className="px-3 py-1 rounded bg-rose-500 text-white">Confirmar</button>
        </div>
      </Modal>

      {/* Modal para editar plan */}
      <Modal
        isOpen={!!editPlan}
        onRequestClose={() => setEditPlan(null)}
        contentLabel="Editar plan"
        className="bg-white rounded p-4 max-w-lg mx-auto mt-20 outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center"
      >
        <h2 className="text-xl font-bold mb-2">Editar plan</h2>
        {editPlan && (
          <form onSubmit={saveEdit} className="space-y-2">
            <label className="block">
              Título:
              <input type="text" value={editPlan.title} onChange={(e) => setEditPlan({ ...editPlan, title: e.target.value })} className="border rounded w-full" required />
            </label>
            <label className="block">
              Descripción:
              <textarea value={editPlan.description || ""} onChange={(e) => setEditPlan({ ...editPlan, description: e.target.value })} className="border rounded w-full" />
            </label>
            <label className="block">
              Lugar:
              <input type="text" value={editPlan.location || ""} onChange={(e) => setEditPlan({ ...editPlan, location: e.target.value })} className="border rounded w-full" />
            </label>
            <label className="block">
              Coste estimado:
              <input type="text" value={editPlan.cost || ""} onChange={(e) => setEditPlan({ ...editPlan, cost: e.target.value })} className="border rounded w-full" />
            </label>
            <label className="block">
              Propuesto por:
              <select value={editPlan.proposer || "Yo"} onChange={(e) => setEditPlan({ ...editPlan, proposer: e.target.value })} className="border rounded w-full">
                <option value="Yo">Yo</option>
                <option value="Pareja">Pareja</option>
              </select>
            </label>
            <label className="block">
              Categoría:
              <select value={editPlan.category} onChange={(e) => setEditPlan({ ...editPlan, category: e.target.value as Plan["category"] })} className="border rounded w-full">
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end space-x-2 mt-4">
              <button type="button" onClick={() => setEditPlan(null)} className="px-3 py-1 rounded border">Cancelar</button>
              <button type="submit" className="px-3 py-1 rounded bg-rose-500 text-white">Guardar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default App;
