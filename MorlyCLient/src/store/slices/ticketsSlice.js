import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  tickets: [],
  loading: false,
  error: null,
};

export const ticketsSlice = createSlice({
  name: "tickets",
  initialState,
  reducers: {
    setTickets: (state, action) => {
      state.tickets = action.payload || [];
    },
    addTicket: (state, action) => {
      state.tickets.unshift(action.payload);
    },
    updateTicketInList: (state, action) => {
      const updated = action.payload;
      const index = state.tickets.findIndex(
        (t) => (t.id && t.id === updated.id) || (t._id && t._id === updated._id)
      );
      if (index !== -1) {
        state.tickets[index] = { ...state.tickets[index], ...updated };
      }
    },
    removeTicketFromList: (state, action) => {
      const id = action.payload;
      state.tickets = state.tickets.filter((t) => t.id !== id && t._id !== id);
    },
    setTicketsLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },
    setTicketsError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const {
  setTickets,
  addTicket,
  updateTicketInList,
  removeTicketFromList,
  setTicketsLoading,
  setTicketsError,
} = ticketsSlice.actions;

export default ticketsSlice.reducer;
