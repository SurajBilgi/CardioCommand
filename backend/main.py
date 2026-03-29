import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_tables
from routers import patients, vitals, ai, demo, voice
from routers import calls

app = FastAPI(title="CardioCommand API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router, prefix="/patients", tags=["Patients"])
app.include_router(vitals.router,   prefix="/vitals",   tags=["Vitals"])
app.include_router(ai.router,       prefix="/ai",       tags=["AI"])
app.include_router(demo.router,     prefix="/demo",     tags=["Demo"])
app.include_router(voice.router,    prefix="/voice",    tags=["Voice"])
app.include_router(calls.router,    prefix="/calls",    tags=["Calls"])


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/")
def root():
    return {
        "app": "CardioCommand API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
