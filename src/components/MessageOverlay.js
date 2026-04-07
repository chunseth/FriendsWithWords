import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, useWindowDimensions } from 'react-native';

const WORD_GAME_FONT_FAMILY = Platform.select({
    ios: 'ChalkboardSE-Regular',
    android: 'serif',
    default: 'serif',
});

const MessageOverlay = ({ message, onClose, isDarkMode = false }) => {
    const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;
    const { width: windowWidth } = useWindowDimensions();
    const modalCardWidth = Math.min(Math.max(windowWidth - 40, 280), 400);
    const isWordAcceptedWithTurnPoints =
        message?.title === 'Word Accepted!' &&
        typeof message?.turnPoints === 'number';
    const isAnimatedWordAccepted =
        isWordAcceptedWithTurnPoints &&
        typeof message?.consistencyBonus === 'number' &&
        message.consistencyBonus > 0;

    const [displayPoints, setDisplayPoints] = useState({
        turnPoints: typeof message?.turnPoints === 'number' ? message.turnPoints : 0,
        bonusPoints: typeof message?.consistencyBonus === 'number' ? message.consistencyBonus : 0,
    });
    const [isContentReady, setIsContentReady] = useState(false);
    const animationTimeoutRef = useRef(null);
    const animationStepTimeoutRef = useRef(null);
    const readyFrameRef = useRef(null);
    const readyFrameRef2 = useRef(null);
    const pointsRef = useRef({
        turnPoints: typeof message?.turnPoints === 'number' ? message.turnPoints : 0,
        bonusPoints: typeof message?.consistencyBonus === 'number' ? message.consistencyBonus : 0,
    });

    useEffect(() => {
        if (readyFrameRef.current != null) cancelAnimationFrame(readyFrameRef.current);
        if (readyFrameRef2.current != null) cancelAnimationFrame(readyFrameRef2.current);
        setIsContentReady(false);
        if (!message) {
            return undefined;
        }
        readyFrameRef.current = requestAnimationFrame(() => {
            readyFrameRef2.current = requestAnimationFrame(() => {
                setIsContentReady(true);
            });
        });
        return () => {
            if (readyFrameRef.current != null) cancelAnimationFrame(readyFrameRef.current);
            if (readyFrameRef2.current != null) cancelAnimationFrame(readyFrameRef2.current);
        };
    }, [message]);

    useEffect(() => {
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        if (animationStepTimeoutRef.current) clearTimeout(animationStepTimeoutRef.current);
        animationTimeoutRef.current = null;
        animationStepTimeoutRef.current = null;

        const initialTurnPoints =
            typeof message?.turnPoints === 'number' ? message.turnPoints : 0;
        const initialBonusPoints =
            typeof message?.consistencyBonus === 'number' ? message.consistencyBonus : 0;

        setDisplayPoints({
            turnPoints: initialTurnPoints,
            bonusPoints: initialBonusPoints,
        });
        pointsRef.current = {
            turnPoints: initialTurnPoints,
            bonusPoints: initialBonusPoints,
        };

        if (!isAnimatedWordAccepted) {
            return undefined;
        }

        const getBonusAnimationStepMs = (bonusPoints) => {
            if (bonusPoints >= 51) return 10;
            if (bonusPoints >= 21) return 20;
            if (bonusPoints >= 11) return 50;
            return 100;
        };

        const animateNextPoint = (stepMs) => {
            const { turnPoints, bonusPoints } = pointsRef.current;
            if (bonusPoints <= 0) {
                animationStepTimeoutRef.current = null;
                return;
            }

            const nextTurnPoints = turnPoints + 1;
            const nextBonusPoints = bonusPoints - 1;
            const nextDisplayPoints = {
                turnPoints: nextTurnPoints,
                bonusPoints: nextBonusPoints,
            };

            pointsRef.current = nextDisplayPoints;
            setDisplayPoints(nextDisplayPoints);

            if (nextBonusPoints <= 0) {
                animationStepTimeoutRef.current = null;
                return;
            }

            animationStepTimeoutRef.current = setTimeout(() => {
                animateNextPoint(stepMs);
            }, stepMs);
        };

        animationTimeoutRef.current = setTimeout(() => {
            const stepMs = getBonusAnimationStepMs(initialBonusPoints);
            animateNextPoint(stepMs);
        }, 1200);

        return () => {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
            if (animationStepTimeoutRef.current) clearTimeout(animationStepTimeoutRef.current);
        };
    }, [isAnimatedWordAccepted, message]);

    if (!message) return null;
    const playedWords = Array.isArray(message?.playedWords)
        ? message.playedWords
        : (typeof message?.text === 'string' && message.text.startsWith('Words: ')
            ? message.text
                .replace('Words: ', '')
                .split(',')
                .map((word) => word.trim())
                .filter(Boolean)
            : []);
    
    return (
        <Modal
            visible={!!message}
            transparent={true}
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={styles.overlay} 
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity 
                    style={[
                        styles.content,
                        { width: modalCardWidth },
                        { backgroundColor: theme.contentBackground },
                        !isContentReady && styles.contentHidden,
                    ]} 
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                >
                    {!isWordAcceptedWithTurnPoints && (
                        <Text style={[styles.title, { color: theme.title }]}>{message.title}</Text>
                    )}
                    {isWordAcceptedWithTurnPoints ? (
                        <>
                            <View style={styles.wordsHeaderWrap}>
                                <Text style={[styles.wordsHeader, { color: theme.title }]}>
                                    Words Played
                                </Text>
                                <View style={[styles.sectionDividerLine, styles.wordsHeaderLine, { backgroundColor: theme.title }]} />
                            </View>
                            <View style={styles.wordsStack}>
                                {playedWords.map((word, index) => (
                                    <Text
                                        key={`${word}-${index}`}
                                        style={[styles.playedWordText, { color: theme.body }]}
                                    >
                                        {word}
                                    </Text>
                                ))}
                            </View>
                            <View style={[styles.sectionDividerLine, styles.wordsToPointsDivider, { backgroundColor: theme.title }]} />
                            <View style={styles.turnSummaryRow}>
                                <View style={styles.pointsLineRow}>
                                    <Text style={[styles.pointsLineText, { color: theme.body }]}>
                                        {displayPoints.turnPoints}
                                    </Text>
                                    <Text style={[styles.pointsLineText, { color: theme.body }]}> points</Text>
                                    {isAnimatedWordAccepted && displayPoints.bonusPoints > 0 && (
                                        <Text style={[styles.pointsLineBonusText, { color: theme.bonusText }]}>
                                            {' '}+{displayPoints.bonusPoints}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            {isAnimatedWordAccepted && (
                                <Text style={[styles.comboLabel, { color: theme.bonusText }]}>
                                    Combo Bonus! +{message.consistencyBonus}
                                </Text>
                            )}
                            {typeof message?.scrabbleBonusMessage === 'string' &&
                                message.scrabbleBonusMessage.length > 0 && (
                                    <Text style={[styles.bonusMessageText, { color: theme.bonusText }]}>
                                        {message.scrabbleBonusMessage}
                                    </Text>
                                )}
                            <View style={styles.wordAcceptedBottomSpacer} />
                        </>
                    ) : (
                        <Text style={[styles.text, { color: theme.body }]}>{message.text}</Text>
                    )}
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.buttonBackground }]}
                        onPress={onClose}
                    >
                        <Text style={styles.buttonText}>OK</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const LIGHT_THEME = {
    contentBackground: 'white',
    title: '#2c3e50',
    body: '#7f8c8d',
    bonusText: '#2f6f4f',
    buttonBackground: '#667eea',
};

const DARK_THEME = {
    contentBackground: '#1a2431',
    title: '#f8fafc',
    body: '#cbd5e1',
    bonusText: '#86efac',
    buttonBackground: '#4f46e5',
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 30,
        alignItems: 'center',
    },
    contentHidden: {
        opacity: 0,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 15,
    },
    text: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 22,
    },
    turnSummaryRow: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    pointsLineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    wordsStack: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    wordsHeader: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: WORD_GAME_FONT_FAMILY,
    },
    wordsHeaderWrap: {
        alignItems: 'center',
        marginBottom: 8,
    },
    sectionDividerLine: {
        width: 130,
        height: 1,
        borderRadius: 1,
    },
    wordsHeaderLine: {
        marginTop: 4,
    },
    wordsToPointsDivider: {
        marginBottom: 12,
    },
    playedWordText: {
        fontSize: 22,
        fontWeight: '700',
        fontFamily: WORD_GAME_FONT_FAMILY,
        lineHeight: 28,
        textAlign: 'center',
    },
    pointsLineText: {
        fontSize: 16,
        color: '#7f8c8d',
        lineHeight: 22,
        fontWeight: '700',
        fontFamily: WORD_GAME_FONT_FAMILY,
    },
    pointsLineBonusText: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '700',
        fontFamily: WORD_GAME_FONT_FAMILY,
    },
    comboLabel: {
        fontSize: 16,
        color: '#2f6f4f',
        fontWeight: '700',
        fontFamily: WORD_GAME_FONT_FAMILY,
        marginBottom: 10,
    },
    bonusMessageText: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    wordAcceptedBottomSpacer: {
        height: 20,
    },
    button: {
        backgroundColor: '#667eea',
        borderRadius: 8,
        padding: 12,
        minWidth: 100,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default MessageOverlay;
