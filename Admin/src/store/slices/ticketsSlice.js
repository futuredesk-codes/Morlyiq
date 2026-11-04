import { createSlice } from "@reduxjs/toolkit";

const ticketsSlice = createSlice({
  name: "tickets",
  initialState: {
    tickets: [],
  },
  reducers: {
    setTickets: (state, action) => {
      state.tickets = action.payload;
    },
    addTicket: (state, action) => {
      state.tickets.unshift(action.payload);
    },
    updateTicket: (state, action) => {
      const idx = state.tickets.findIndex((t) => t.id === action.payload.id || t._id === action.payload._id);
      if (idx !== -1) {
        state.tickets[idx] = { ...state.tickets[idx], ...action.payload };
      }
    },
  },
});

export const { setTickets, addTicket, updateTicket } = ticketsSlice.actions;
export default ticketsSlice.reducer;
