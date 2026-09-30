import { db } from "./firebase.config.js";
import { collection, getDocs, doc, writeBatch, addDoc, updateDoc, deleteDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==============================
// GESTIÓN DE FIXTURES
// ==============================
export async function getFixtures() {
    try {
        const snapshot = await getDocs(collection(db, "fixtures"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener los partidos:", error);
        return [];
    }
}
export const addFixture = async (data) => await addDoc(collection(db, "fixtures"), data);
export const updateFixture = async (id, data) => await updateDoc(doc(db, "fixtures", id), data);
export const deleteFixture = async (id) => await deleteDoc(doc(db, "fixtures", id));

// ==============================
// JUGADORES Y PLANTELES
// ==============================
export async function getPlayers() {
    try {
        const snapshot = await getDocs(collection(db, "players"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener jugadores:", error);
        return [];
    }
}

export async function addPlayersBulk(playersArray) {
    try {
        const batch = writeBatch(db);
        playersArray.forEach(player => {
            const newRef = doc(collection(db, "players"));
            batch.set(newRef, player);
        });
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error en carga masiva:", error);
        throw error;
    }
}

export const updatePlayer = async (id, data) => await updateDoc(doc(db, "players", id), data);
export const deletePlayer = async (id) => await deleteDoc(doc(db, "players", id));