#!/bin/bash
# CardioCommand — Start All Services

echo "🚀 Starting CardioCommand..."

# Backend
echo "📡 Starting backend on :8000..."
cd backend
if [ ! -d "rag/faiss_index" ]; then
  echo "📚 Building RAG index (first time only)..."
  python -c "from rag.indexer import build_index; build_index()" 2>/dev/null || echo "RAG index build skipped (check OPENAI_API_KEY)"
fi
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# MD Dashboard
echo "🖥️  Starting MD Dashboard on :5173..."
cd apps/md-dashboard
npm run dev &
MD_PID=$!
cd ../..

# Patient App
echo "📱 Starting Patient App on :5174..."
cd apps/patient-app
npm run dev &
PATIENT_PID=$!
cd ../..

echo ""
echo "✅ CardioCommand is running!"
echo ""
echo "  MD Dashboard:  http://localhost:5173?demo=true"
echo "  Patient App:   http://localhost:5174?demo=true"
echo "  API Docs:      http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

wait
