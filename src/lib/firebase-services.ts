import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';

export const ticketService = {
  getAll: async () => {
    try {
      const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        documentId: doc.id, 
        ...doc.data() 
      }));
    } catch (error) {
      // Fallback if index isn't created yet or other error
      console.warn('Error fetching tickets with order, trying without order:', error);
      const snapshot = await getDocs(collection(db, 'tickets'));
      return snapshot.docs.map(doc => ({ 
        documentId: doc.id, 
        ...doc.data() 
      }));
    }
  },
  add: async (data: any) => {
    return await addDoc(collection(db, 'tickets'), {
      ...data,
      createdAt: data.createdAt || new Date().toISOString()
    });
  },
  update: async (id: string, data: any) => {
    const docRef = doc(db, 'tickets', id);
    return await updateDoc(docRef, data);
  }
};

export const companyService = {
  getAll: async () => {
    const snapshot = await getDocs(collection(db, 'companies'));
    return snapshot.docs.map(doc => ({ 
      documentId: doc.id, 
      ...doc.data() 
    }));
  },
  add: async (data: any) => {
    return await addDoc(collection(db, 'companies'), data);
  }
};

export const deviceService = {
  getAll: async () => {
    const snapshot = await getDocs(collection(db, 'devices'));
    return snapshot.docs.map(doc => ({ 
      documentId: doc.id, 
      ...doc.data() 
    }));
  },
  add: async (data: any) => {
    return await addDoc(collection(db, 'devices'), data);
  }
};
