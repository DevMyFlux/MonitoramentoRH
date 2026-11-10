// Apoio dos testes de componente: os testes conferem o estado final da tela, então as animações
// do Motion (entradas, números que contam, barras que enchem) pulam direto para o fim.
import { MotionGlobalConfig } from "motion/react";

MotionGlobalConfig.skipAnimations = true;
