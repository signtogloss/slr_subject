import React, { useState, useEffect, useRef } from 'react';

const SignLanguageRecognition = () => {
    const [recognitions, setRecognitions] = useState([]);
    const [error, setError] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef(null);
    const socket = useRef(null);
    const videoRef = useRef();
    const streamRef = useRef();

    // 摄像头初始化
    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = stream;
                videoRef.current.srcObject = stream;
                
                const isChrome = navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Edge');
                const options = isChrome ? { 
                    bitsPerSecond: 1000000,
                    mimeType: 'video/webm;codecs=VP9'
                } : { bitsPerSecond: 1000000 };
                
                mediaRecorder.current = new MediaRecorder(stream, options);

            } catch (err) {
                setError(`摄像头访问失败: ${err.message}`);
            }
        };

        initCamera();
        return () => {
            mediaRecorder.current?.stop();
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const startRecognition = () => {
        if (!mediaRecorder.current) return;

        socket.current = new WebSocket('wss://api.sign-speak.com/stream-recognize-sign');
        
        socket.current.onopen = () => {
            console.log('WebSocket连接成功');
            const config = {
                api_key: process.env.REACT_APP_SIGNSPEAK_API_KEY,
                slice_length: 500,
                single_recognition_mode: false
            };
            socket.current.send(JSON.stringify(config));
            
            // 在连接成功后设置数据回调
            mediaRecorder.current.ondataavailable = async (e) => {
                if (socket.current?.readyState === WebSocket.OPEN) {
                    const blob = new Blob([e.data], { type: 'video/mp4' });
                    try {
                        const buffer = await blob.arrayBuffer();
                        socket.current.send(buffer);
                    } catch (err) {
                        console.error('数据发送失败:', err);
                    }
                }
            };

            mediaRecorder.current.start(500);
            setIsRecording(true);
        };

        socket.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data === 'OUT_OF_QUOTA') {
                    setError('API配额已用尽');
                    return;
                }
                setRecognitions(prev => [
                    ...prev,
                    ...(data.prediction || []).map(p => ({
                        text: p.prediction,
                        confidence: p.confidence
                    }))
                ]);
            } catch (err) {
                console.warn('解析响应失败:', err);
            }
        };

        socket.current.onerror = (error) => {
            console.error('WebSocket错误:', error);
            setError('连接识别服务失败');
        };
    };

    const stopRecognition = () => {
        mediaRecorder.current?.stop();
        
        // 延迟确保最后分片处理完成
        setTimeout(() => {
            if (socket.current?.readyState === WebSocket.OPEN) {
                socket.current.send('DONE');
                socket.current.close();
                console.log('WebSocket安全关闭');
            }
            setIsRecording(false);
            socket.current = null;
        }, 800);
    };

    return (
        <div className="recognition-container">
            <video ref={videoRef} autoPlay muted playsInline />
            {error && <div className="error">{error}</div>}
            <button onClick={isRecording ? stopRecognition : startRecognition}>
                {isRecording ? '停止识别' : '开始识别'}
            </button>
            <div className="results">
                {recognitions.map((rec, i) => (
                    <div key={i}>
                        {rec.text} ({Math.round(rec.confidence * 100)}%)
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SignLanguageRecognition;