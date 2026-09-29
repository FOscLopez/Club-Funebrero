import { db } from "./firebase.config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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