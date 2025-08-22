package com.padel;

import java.io.*;
import java.nio.file.*;
import java.util.*;

public class ServerLauncher {
    public static void main(String[] args) throws Exception {
        String projectRoot = Paths.get("").toAbsolutePath().toString();
        Path backendDir = Paths.get(projectRoot, "backend");
        Path envFile = backendDir.resolve(".env");

        if (!Files.exists(envFile)) {
            Files.writeString(envFile, "PORT=3001\nJWT_SECRET=change-me\nDB_PATH=./data/padel.db\n");
            System.out.println("Created backend/.env with defaults");
        }

        ProcessBuilder npmInstall = new ProcessBuilder("bash", "-lc", "cd '" + backendDir + "' && npm ci || npm install");
        npmInstall.inheritIO();
        Process installProc = npmInstall.start();
        if (installProc.waitFor() != 0) {
            System.err.println("npm install failed");
            System.exit(1);
        }

        ProcessBuilder migrate = new ProcessBuilder("bash", "-lc", "cd '" + backendDir + "' && npm run migrate");
        migrate.inheritIO();
        Process migProc = migrate.start();
        if (migProc.waitFor() != 0) {
            System.err.println("migration failed");
            System.exit(1);
        }

        ProcessBuilder start = new ProcessBuilder("bash", "-lc", "cd '" + backendDir + "' && npm start");
        start.inheritIO();
        Process server = start.start();
        System.out.println("Node server started. Press Ctrl+C to stop.");
        server.waitFor();
    }
}


