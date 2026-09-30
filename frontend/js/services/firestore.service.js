import { db } from "./firebase.config.js";
import { collection, getDocs, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function getFixtures() {
    try {
        const snapshot = await getDocs(collection(db, "fixtures"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener los partidos:", error);
        return [];
    }
}

export async function getClubs() {
    try {
        const snapshot = await getDocs(collection(db, "clubs"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener los clubes:", error);
        return [];
    }
}

export async function getCategories() {
    try {
        const snapshot = await getDocs(collection(db, "categories"));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener las categorías:", error);
        return [];
    }
}

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